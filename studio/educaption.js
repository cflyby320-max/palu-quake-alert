// Captions for the educational (evergreen) track.
//
// Default path is ZERO-LLM: the caption is authored, final prose in bank.js, so
// buildEduCaption just returns it (the one place footer/hashtags would be added
// if an entry omitted them). validateEduCaption is the safety gate — every
// authored caption is asserted against it in the tests, and any opt-in LLM
// rephrase must pass it or we fall back to the authored text.

// Required framing on EVERY caption (safety invariants, see CLAUDE.md §10).
const REQUIRED = [/bukan peringatan dini/i, /BMKG/i];

// Banned claims — an account that fights misinformation must never imply an
// all-clear, a prediction, or a false-precision 2018 toll. Note we deliberately
// do NOT ban the words "prediksi/gempa besok": Pillar-3 debunks must quote the
// hoax to refute it. The mustInclude assertions carry the positive framing.
const BANNED = [
  /\b(sudah|kini|telah|dinyatakan)\s+aman\b/i,
  /\bkondisi\s+aman\b/i,
  /\baman\s+terkendali\b/i,
  /\btidak akan terjadi\b/i,
  /\bpasti\s+(terjadi|aman)\b/i,
  /\b[1-9]\.?\d{3}\s+(orang\s+)?(tewas|meninggal)\b/i, // false-precision toll
  /\b(4\.?340|2\.?077|3\.?879)\b/, // the specific contested 2018 figures
];

// Pure: assert a caption body is safe + on-message for this post.
// Returns { ok: true } or { ok: false, reason }.
export function validateEduCaption(text, post) {
  const s = String(text || '');
  for (const re of REQUIRED) {
    if (!re.test(s)) return { ok: false, reason: `missing required framing: ${re}` };
  }
  for (const re of post.mustInclude || []) {
    if (!re.test(s)) return { ok: false, reason: `missing mustInclude: ${re}` };
  }
  for (const re of BANNED) {
    if (re.test(s)) return { ok: false, reason: `banned phrase present: ${re}` };
  }
  return { ok: true };
}

// Default caption: the authored prose. (Hook for appending shared framing if a
// future entry ships without it — current entries already include it.)
export function buildEduCaption(post) {
  return post.caption;
}

// Fixed framing block re-appended after an LLM rephrase so the model never owns
// the safety lines (footer + routing) or the hashtags.
function framingFor(post) {
  const tagLine = post.caption.match(/Notifikasi cepat[^\n]*\n/);
  const tags = post.caption.match(/#[^\n]*$/);
  return (
    '\n\nNotifikasi cepat — bukan peringatan dini. Ikuti arahan resmi BMKG (InfoBMKG), ' +
    'BNPB, dan BPBD Sulawesi Tengah.' +
    (tags ? `\n\n${tags[0]}` : '')
  );
}

// OPT-IN ONLY (--llm). Rephrase the body via the Claude Messages API over fetch
// (no SDK), then re-append the fixed framing, validate, and FALL BACK to the
// authored caption on any failure / missing key / timeout. The model only ever
// rewords curated facts — it cannot introduce an unsafe claim that survives
// validateEduCaption.
export async function draftEduCaption(post, { timeoutMs = 30000 } = {}) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return { caption: buildEduCaption(post), llm: false, reason: 'no-api-key' };

  const model = (process.env.STUDIO_LLM_MODEL || 'claude-opus-4-8').trim();
  // Strip the existing framing/hashtags so the model rewords only the body.
  const body = post.caption.split('\n\nNotifikasi cepat')[0].trim();
  const system =
    'Anda penyunting media sosial untuk akun keselamatan gempa di Sulawesi Tengah. ' +
    'Tulis ulang teks berikut dalam Bahasa Indonesia yang tenang, hangat, dan jelas. ' +
    'WAJIB: pertahankan SEMUA fakta dan angka apa adanya (jangan mengubah atau ' +
    'menambah angka korban; gunakan "lebih dari 4.000" jika ada). DILARANG: membuat ' +
    'prediksi gempa, menyatakan keadaan "sudah aman", atau memberi kesan peringatan ' +
    'dini. Jangan menambahkan tagar, tautan, atau baris sumber — itu ditambahkan ' +
    'terpisah. Balas hanya dengan teks captionnya.';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: body }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`messages HTTP ${res.status}`);
    const data = await res.json();
    const drafted = (data?.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!drafted) throw new Error('empty draft');

    const candidate = drafted + framingFor(post);
    const v = validateEduCaption(candidate, post);
    if (!v.ok) return { caption: buildEduCaption(post), llm: false, reason: `validation: ${v.reason}` };
    return { caption: candidate, llm: true };
  } catch (e) {
    return { caption: buildEduCaption(post), llm: false, reason: e.message };
  }
}
