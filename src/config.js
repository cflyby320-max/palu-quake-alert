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

function bool(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

// Trimmed string env. Secrets pasted into a host's UI (e.g. GitHub Secrets)
// very often pick up a stray leading/trailing space. A space in the bot-token
// URL path is percent-encoded and makes Telegram return HTTP 404 ("Not Found"),
// silently breaking delivery — so always trim tokens/credentials, never use raw.
// (Tab/CR/newline happen to be stripped by the URL parser; a space is not.)
function str(key) {
  return (process.env[key] || '').trim();
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
export const MAX_EVENT_AGE_HOURS = num('MAX_EVENT_AGE_HOURS', 6); // max age for a real-time push; dedup makes a wider window safe, and the twice-daily digest catches anything older
export const SHAKEMAP_MIN_MAG = num('SHAKEMAP_MIN_MAG', 0); // attach the BMKG shakemap image inline whenever BMKG provides one (0 = no magnitude gate; raise to suppress images on smaller quakes)
export const SEQUENCE_WINDOW_HOURS = num('SEQUENCE_WINDOW_HOURS', 24); // lookback for the "Nth quake near Palu" aftershock-context line

// --- Seismic Activity Outlook (aftershock-probability heads-up) -------------
// See OUTLOOK_DESIGN.md for the model, parameter sources, and safety framing.
export const OUTLOOK_ENABLED = bool('OUTLOOK_ENABLED', true); // kill-switch; posts after a qualifying mainshock
export const OUTLOOK_TRIGGER_MAG = num('OUTLOOK_TRIGGER_MAG', 5.5); // mainshock magnitude that triggers an Outlook
export const OUTLOOK_FELT_MAG = num('OUTLOOK_FELT_MAG', 4.0); // "felt aftershock" threshold reported in the Outlook
export const OUTLOOK_STRONG_MAG = num('OUTLOOK_STRONG_MAG', 6.0); // "strong/damaging aftershock" threshold
// Reasenberg-Jones / modified-Omori generic parameters (approximate, configurable).
export const AFTERSHOCK_A = num('AFTERSHOCK_A', -1.67); // productivity (more negative = fewer aftershocks)
export const AFTERSHOCK_B = num('AFTERSHOCK_B', 1.0); // Gutenberg-Richter b-value default
export const AFTERSHOCK_P = num('AFTERSHOCK_P', 1.07); // Omori-Utsu decay exponent
export const AFTERSHOCK_C = num('AFTERSHOCK_C', 0.05); // Omori-Utsu time offset (days)
export const B_MIN_SAMPLE = num('B_MIN_SAMPLE', 50); // min events before trusting a locally-fitted b-value
export const CATALOG_MIN_MAG = num('CATALOG_MIN_MAG', 3.5); // accumulate near-Palu events at/above this into the catalog
export const CATALOG_RETENTION_DAYS = num('CATALOG_RETENTION_DAYS', 60); // how long the local catalog is kept

// --- Twice-daily digest (catch-up recap, posted from the always-on loop) -----
// Fires at 08:00 & 20:00 WITA (00:00 & 12:00 UTC) from inside the monitoring
// loop, built from the persisted catalog so it always matches the real-time
// alerts. (The old GitHub-Actions digest re-fetched live feeds and could miss a
// quake that had rolled off the feed — see git history.)
export const DIGEST_ENABLED = bool('DIGEST_ENABLED', true); // kill-switch
export const DIGEST_HOURS = num('DIGEST_HOURS', 24); // lookback window for the recap

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
    token: str('TELEGRAM_BOT_TOKEN'),
    chatIds: list('TELEGRAM_CHAT_IDS'),
  },
  twilioSms: {
    sid: str('TWILIO_SID'),
    token: str('TWILIO_TOKEN'),
    from: str('TWILIO_FROM'),
    to: list('TWILIO_TO'),
  },
  twilioWhatsapp: {
    sid: str('TWILIO_SID'),
    token: str('TWILIO_TOKEN'),
    from: str('TWILIO_WHATSAPP_FROM'), // e.g. "whatsapp:+14155238886"
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
