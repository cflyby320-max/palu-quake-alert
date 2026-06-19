// Multi-channel, multi-recipient delivery. Console + file log always run so
// there is always a record. External channels (Telegram, Twilio SMS/WhatsApp)
// run only when configured. One channel failing never blocks the others.

import { appendFileSync } from 'node:fs';
import { channels, LOG_FILE, HTTP_TIMEOUT_MS } from './config.js';

function stamp() {
  return new Date().toISOString();
}

export function log(level, msg) {
  const line = `${stamp()} [${level}] ${msg}`;
  if (level === 'ERROR' || level === 'CRITICAL') console.error(line);
  else console.log(line);
  try {
    appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* never let logging failure crash the watcher */
  }
}

async function postForm(url, form, headers = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams(form).toString(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

const TELEGRAM_CAPTION_MAX = 1024; // Telegram's hard limit for a photo caption.

async function tgSendMessage(chatId, text) {
  await postForm(`https://api.telegram.org/bot${channels.telegram.token}/sendMessage`, {
    chat_id: chatId,
    text,
    disable_web_page_preview: 'true',
  });
}

async function tgSendPhoto(chatId, photo, caption) {
  await postForm(`https://api.telegram.org/bot${channels.telegram.token}/sendPhoto`, {
    chat_id: chatId,
    photo,
    caption,
  });
}

// Deliver one alert to one chat. The TEXT must always get through, so a broken
// or unreachable shakemap image never blocks it: when a photo+caption fits we
// send that single rich message but fall back to plain text if Telegram can't
// fetch the image; when the body is too long for a caption we send the full
// text first and add the image as a best-effort extra.
async function deliverTelegram(chatId, { subject, body, photo }) {
  if (photo && body.length <= TELEGRAM_CAPTION_MAX) {
    try {
      await tgSendPhoto(chatId, photo, body);
      return;
    } catch (e) {
      log('WARN', `telegram shakemap photo failed (${chatId}); sending text only: ${e}`);
      await tgSendMessage(chatId, body);
      return;
    }
  }
  await tgSendMessage(chatId, body);
  if (photo) {
    try {
      await tgSendPhoto(chatId, photo, subject);
    } catch (e) {
      log('WARN', `telegram shakemap photo failed (${chatId}): ${e}`);
    }
  }
}

async function sendTelegram(msg) {
  const results = [];
  for (const chatId of channels.telegram.chatIds) {
    try {
      await deliverTelegram(chatId, msg);
      results.push({ channel: 'telegram', to: chatId, ok: true });
    } catch (e) {
      results.push({ channel: 'telegram', to: chatId, ok: false, error: String(e) });
    }
  }
  return results;
}

// Send one plain message to a single chat (used by the digest to post a recap).
export async function sendTelegramTo(chatId, text) {
  await tgSendMessage(chatId, text);
}

async function sendTwilio(cfg, body, whatsapp) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`;
  const auth = 'Basic ' + Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64');
  const results = [];
  const label = whatsapp ? 'twilio-whatsapp' : 'twilio-sms';
  for (const raw of cfg.to) {
    const to = whatsapp ? (raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`) : raw;
    try {
      await postForm(url, { From: cfg.from, To: to, Body: body }, { Authorization: auth });
      results.push({ channel: label, to, ok: true });
    } catch (e) {
      results.push({ channel: label, to, ok: false, error: String(e) });
    }
  }
  return results;
}

// Sends one alert across every configured channel. `dryRun` skips external
// sends (console + file only) — used for tests and the offline demo.
export async function notifyAll(msg, { dryRun = false } = {}) {
  const { subject, body, photo } = msg;
  log('ALERT', subject);
  // Guard the log write: a transient file lock (e.g. cloud-sync) must NEVER
  // abort the actual alert delivery below.
  try {
    appendFileSync(LOG_FILE, body + '\n---\n');
  } catch {
    /* ignore — delivery is what matters */
  }

  if (dryRun) {
    console.log(
      '\n----- ALERT (dry-run, not sent externally) -----\n' +
        body +
        (photo ? `\n[+ shakemap image attached: ${photo}]` : '') +
        '\n'
    );
    return { dryRun: true, results: [] };
  }

  const tasks = [];
  if (channels.telegram.token && channels.telegram.chatIds.length) tasks.push(sendTelegram(msg));
  if (channels.twilioSms.sid && channels.twilioSms.from && channels.twilioSms.to.length)
    tasks.push(sendTwilio(channels.twilioSms, body, false));
  if (
    channels.twilioWhatsapp.sid &&
    channels.twilioWhatsapp.from &&
    channels.twilioWhatsapp.to.length
  )
    tasks.push(sendTwilio(channels.twilioWhatsapp, body, true));

  if (tasks.length === 0) {
    log('WARN', 'No external channels configured — alert logged only. Add Telegram/Twilio creds.');
    return { dryRun: false, results: [] };
  }

  const results = (await Promise.all(tasks)).flat();
  for (const r of results) {
    if (r.ok) log('INFO', `delivered via ${r.channel} -> ${r.to}`);
    else log('ERROR', `FAILED ${r.channel} -> ${r.to}: ${r.error}`);
  }
  if (results.length && results.every((r) => !r.ok)) {
    log('CRITICAL', 'ALL delivery channels failed for an alert. Check credentials/network NOW.');
  }
  return { dryRun: false, results };
}
