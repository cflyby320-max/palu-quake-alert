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

async function sendTelegram(text) {
  const { token, chatIds } = channels.telegram;
  const results = [];
  for (const chatId of chatIds) {
    try {
      await postForm(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        disable_web_page_preview: 'true',
      });
      results.push({ channel: 'telegram', to: chatId, ok: true });
    } catch (e) {
      results.push({ channel: 'telegram', to: chatId, ok: false, error: String(e) });
    }
  }
  return results;
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
export async function notifyAll({ subject, body }, { dryRun = false } = {}) {
  log('ALERT', subject);
  appendFileSync(LOG_FILE, body + '\n---\n');

  if (dryRun) {
    console.log('\n----- ALERT (dry-run, not sent externally) -----\n' + body + '\n');
    return { dryRun: true, results: [] };
  }

  const tasks = [];
  if (channels.telegram.token && channels.telegram.chatIds.length) tasks.push(sendTelegram(body));
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
