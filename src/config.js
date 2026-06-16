// All configuration comes from environment variables.
// Locally we load them with `node --env-file=.env` (Node 20+). On a host you
// set real environment variables instead. Nothing secret is hard-coded.

function num(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function list(key) {
  return (process.env[key] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- Who we are protecting: Palu city center -------------------------------
export const PALU = {
  lat: num('PALU_LAT', -0.8917),
  lon: num('PALU_LON', 119.8707),
};

// --- What counts as alert-worthy -------------------------------------------
export const ALERT_RADIUS_KM = num('ALERT_RADIUS_KM', 350); // only events this close to Palu
export const MIN_MAGNITUDE = num('MIN_MAGNITUDE', 5.0); // boundary: below this => LOW level
export const INFO_MAGNITUDE = num('INFO_MAGNITUDE', 4.0); // alert floor; below this: log only
// (Set INFO_MAGNITUDE=2.5 to be alerted about every minor quake the feeds report
//  — expect many during an aftershock sequence; risk of alert fatigue.)
export const STRONG_MAGNITUDE = num('STRONG_MAGNITUDE', 6.0); // likely strongly felt nearby
export const TSUNAMI_MAG = num('TSUNAMI_MAG', 6.5); // precautionary high-ground threshold
export const SHALLOW_KM = num('SHALLOW_KM', 70); // shallow quakes shake/displace water more
export const MAX_EVENT_AGE_HOURS = num('MAX_EVENT_AGE_HOURS', 2); // ignore stale events at startup

// --- Cross-source correlation (treat 2 feeds' versions as 1 physical quake) -
export const SAME_EVENT_SECONDS = num('SAME_EVENT_SECONDS', 90);
export const SAME_EVENT_KM = num('SAME_EVENT_KM', 75);
// Re-alert if a preliminary magnitude is later revised UP by at least this much
export const ESCALATION_DELTA = num('ESCALATION_DELTA', 0.5);

// --- Runtime ----------------------------------------------------------------
export const POLL_SECONDS = num('POLL_SECONDS', 45);
export const HTTP_TIMEOUT_MS = num('HTTP_TIMEOUT_MS', 10000);
export const HTTP_RETRIES = num('HTTP_RETRIES', 3);
export const STATE_FILE = process.env.STATE_FILE || 'state.json';
export const LOG_FILE = process.env.LOG_FILE || 'quake_alert.log';
export const STATE_RETENTION_DAYS = num('STATE_RETENTION_DAYS', 14);

// Dead-man's-switch: ping this URL after every healthy cycle. If the pings
// stop (process crashed / host died), an external monitor (e.g. healthchecks.io)
// alerts YOU that the alerter itself is down. This closes the scariest gap:
// a silently dead watcher giving false confidence.
export const HEARTBEAT_URL = (process.env.HEARTBEAT_URL || '').trim();

// Palu is in the WITA timezone (UTC+8). BMKG's "Jam" field is WIB (UTC+7),
// so we compute local time ourselves from the UTC timestamp to be correct.
export const WITA_OFFSET_HOURS = 8;

// --- Notification channels --------------------------------------------------
// A channel is "active" only if its credentials are present, so the same code
// runs whether you've configured Telegram, Twilio, both, or neither.
export const channels = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatIds: list('TELEGRAM_CHAT_IDS'),
  },
  twilioSms: {
    sid: process.env.TWILIO_SID || '',
    token: process.env.TWILIO_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
    to: list('TWILIO_TO'),
  },
  twilioWhatsapp: {
    sid: process.env.TWILIO_SID || '',
    token: process.env.TWILIO_TOKEN || '',
    from: process.env.TWILIO_WHATSAPP_FROM || '', // e.g. "whatsapp:+14155238886"
    to: list('TWILIO_WHATSAPP_TO'),
  },
};

export function activeChannelNames() {
  const names = [];
  if (channels.telegram.token && channels.telegram.chatIds.length) names.push('telegram');
  if (channels.twilioSms.sid && channels.twilioSms.from && channels.twilioSms.to.length)
    names.push('twilio-sms');
  if (channels.twilioWhatsapp.sid && channels.twilioWhatsapp.from && channels.twilioWhatsapp.to.length)
    names.push('twilio-whatsapp');
  return names;
}
