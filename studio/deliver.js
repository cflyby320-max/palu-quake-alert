// Deliver an Instagram draft (branded card + caption) to the OPERATOR's private
// Telegram chat — never to the family alert recipients. This is the human-in-the-
// loop step: you receive the image + caption, then post to Instagram by hand.
//
// Creds (read from env, same style as src/config.js — trimmed to survive a stray
// space pasted into a host's secret store):
//   STUDIO_REVIEW_CHAT_ID   your own chat id (NOT the family TELEGRAM_CHAT_IDS)
//   STUDIO_BOT_TOKEN        optional; defaults to the existing TELEGRAM_BOT_TOKEN

const API = 'https://api.telegram.org';

function creds() {
  const token = (process.env.STUDIO_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.STUDIO_REVIEW_CHAT_ID || '').trim();
  return { token, chatId };
}

function shortPlace(p) {
  return String(p || '').replace(/^Pusat gempa berada di\s*/i, '').trim();
}

// { png?:Buffer, pngs?:Buffer[], caption:string, m?:MergedEvent, hadShakemap?:bool,
//   label?:string }, { dryRun }. Sends the card(s) with a short header — a single
// photo, or a media-group album for a carousel (>1 image) — then the full caption
// as a separate copy-paste-friendly message. `label` titles the header when there
// is no quake event (educational posts). Returns { delivered, reason? }. Throws
// only on a real send failure (the caller isolates it); missing creds / dry-run resolve.
export async function deliverDraft(
  { png, pngs, caption, m, hadShakemap = true, label } = {},
  { dryRun = false } = {}
) {
  const { token, chatId } = creds();
  const images = pngs && pngs.length ? pngs : png ? [png] : [];
  const title = m
    ? `M${m.magnitude.toFixed(1)}${shortPlace(m.place) ? ' · ' + shortPlace(m.place) : ''}`
    : label || 'Konten';
  const header =
    `📸 Draft — ${title}\n` +
    `Simpan gambar, salin caption di pesan berikutnya, lalu posting ke channel/Instagram.` +
    (m && !hadShakemap ? '\n(catatan: shakemap BMKG tidak tersedia untuk gempa ini)' : '') +
    (images.length > 1 ? `\n(${images.length} gambar — carousel, posting berurutan)` : '');

  if (!token || !chatId) {
    console.log('[studio] STUDIO_REVIEW_CHAT_ID/token not set — draft NOT sent. Would have sent:\n' + header);
    return { delivered: false, reason: 'no-creds' };
  }
  if (dryRun) {
    console.log(`[studio] dry-run — would DM draft to ${chatId}\n${header}\n--- caption ---\n${caption}`);
    return { delivered: false, reason: 'dry-run' };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000);
  try {
    if (images.length > 1) {
      // Album: attach each PNG and reference it from the media JSON; header on first.
      const form = new FormData();
      form.append('chat_id', chatId);
      const media = images.map((buf, i) => {
        form.append(`photo${i}`, new Blob([buf], { type: 'image/png' }), `card-${i + 1}.png`);
        return { type: 'photo', media: `attach://photo${i}`, ...(i === 0 ? { caption: header.slice(0, 1024) } : {}) };
      });
      form.append('media', JSON.stringify(media));
      const r = await fetch(`${API}/bot${token}/sendMediaGroup`, { method: 'POST', body: form, signal: ac.signal });
      if (!r.ok) throw new Error(`sendMediaGroup HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } else {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', header.slice(0, 1024));
      form.append('photo', new Blob([images[0]], { type: 'image/png' }), 'card.png');
      const r = await fetch(`${API}/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: ac.signal });
      if (!r.ok) throw new Error(`sendPhoto HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }

    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ chat_id: chatId, text: caption, disable_web_page_preview: 'true' }).toString(),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`sendMessage HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { delivered: true };
  } finally {
    clearTimeout(timer);
  }
}
