// Evergreen content: a 4-card Instagram feed series adapted from the project
// white paper (docs/whitepaper.html). Bahasa Indonesia only — the audience is the
// local community in Central Sulawesi. Copy stays inside the safety invariants
// (CLAUDE.md): honest framing, the high-ground rule, no false precision, calm
// tone, always defer to BMKG. Rendered by studio/series.js via evergreen.js.

const GH = 'github.com/cflyby320-max/palu-quake-alert';

// Shared caption tail carried on every post (honest framing + sources + tags).
const TAIL =
  '\n\nNotifikasi cepat — BUKAN peringatan dini, BUKAN pengganti BMKG. ' +
  'Jika guncangan kuat di dekat pantai, segera ke tempat tinggi tanpa menunggu konfirmasi.' +
  '\nSumber: BMKG/InaTEWS & USGS · proyek komunitas non-komersial.' +
  '\n\n#Palu #SulawesiTengah #SiagaGempa #InfoGempaPalu #Tsunami #KesiapsiagaanBencana #BMKG';

export const SERIES = [
  // 1 — WHY
  {
    kicker: 'Cerita Kami',
    title: 'Sebuah janji setelah 2018',
    items: [
      { kind: 'para', text: '28 September 2018 — gempa M7,5 dan tsunami melanda Palu. Tsunami dipicu longsor bawah laut: tidak terprediksi model standar, dan peringatan resmi sempat dicabut lebih awal.' },
      { kind: 'para', text: 'Proyek ini lahir dari satu kebutuhan sederhana: memberi tahu keluarga di Palu secepat mungkin saat gempa terjadi — agar ada waktu untuk pindah ke tempat tinggi.' },
      { kind: 'gap', h: 8 },
      { kind: 'dot', color: '#2E9E78', lead: 'Notifikasi cepat, bukan peringatan dini.', sub: 'Biasanya 2–5 menit setelah gempa dipublikasikan BMKG & USGS.' },
    ],
    caption:
      'Mengapa kami membuat ini? (1/4)\n\n' +
      'Pada 28 September 2018, gempa M7,5 dan tsunami melanda Palu. Tsunaminya dipicu longsor bawah laut — tidak terprediksi, dan peringatan resmi sempat dicabut lebih awal.\n\n' +
      'Peringatan Gempa Palu lahir dari satu kebutuhan: memberi tahu keluarga secepat mungkin agar ada waktu ke tempat tinggi. Ini notifikasi cepat (2–5 menit), bukan peringatan dini.' +
      TAIL,
  },

  // 2 — STATUS QUO
  {
    kicker: 'Status Proyek',
    title: 'Yang sudah jalan & yang terbuka',
    titleSize: 50,
    items: [
      { kind: 'head', text: 'Sudah jalan', color: '#2E9E78' },
      { kind: 'dot', color: '#2E9E78', lead: 'Inti: BMKG + USGS, 1 gempa = 1 peringatan.' },
      { kind: 'dot', color: '#2E9E78', lead: 'Konteks, Seismic Outlook & rekap 2×/hari.' },
      { kind: 'dot', color: '#2E9E78', lead: 'Brand kit, halaman publik & Studio.' },
      { kind: 'gap', h: 18 },
      { kind: 'head', text: 'Masih terbuka', color: '#E8A33D' },
      { kind: 'dot', color: '#E8A33D', lead: 'Posting otomatis ke Instagram (Graph API).' },
      { kind: 'dot', color: '#E8A33D', lead: 'Bot interaktif: /start, /stop, /status.' },
      { kind: 'dot', color: '#E8A33D', lead: 'Telegram Channel untuk jangkauan luas.' },
    ],
    caption:
      'Sampai di mana proyek ini? (2/4)\n\n' +
      'SUDAH JALAN ✅\n' +
      '• Pengawas inti (BMKG + USGS) — satu gempa, satu peringatan\n' +
      '• Konteks per-peringatan, Seismic Outlook & rekap dua kali sehari\n' +
      '• Brand kit, halaman publik, dan Studio kartu (mode manual)\n\n' +
      'MASIH TERBUKA 🛠️\n' +
      '• Posting otomatis ke Instagram\n' +
      '• Bot interaktif (/start, /stop)\n' +
      '• Telegram Channel untuk menjangkau lebih banyak warga\n\n' +
      'Semua sumber terbuka di ' + GH +
      TAIL,
  },

  // 3 — SAFETY PRINCIPLES
  {
    kicker: '5 Prinsip',
    title: 'Yang tak bisa ditawar',
    items: [
      { kind: 'num', n: 1, lead: '"Tidak ada potensi tsunami" ≠ "aman".', sub: 'Gempa besar & dangkal dekat pantai → selalu imbau ke tempat tinggi.' },
      { kind: 'num', n: 2, lead: 'Penggabungan sumber yang konservatif.', sub: 'Jika satu sumber memperingatkan tsunami, kami memperingatkan.' },
      { kind: 'num', n: 3, lead: 'Framing yang jujur.', sub: 'Notifikasi cepat ~2–5 menit — bukan peringatan dini, bukan pengganti BMKG.' },
      { kind: 'num', n: 4, lead: 'Bahasa Indonesia, waktu WITA, nada tenang.', sub: 'Singkat & mudah dipindai; menghindari kelelahan peringatan.' },
      { kind: 'num', n: 5, lead: 'Outlook = peluang meningkat.', sub: 'Bukan ramalan, bukan "aman". Selalu rujuk BMKG.' },
    ],
    caption:
      '5 prinsip keselamatan kami yang tak bisa ditawar (3/4)\n\n' +
      '1. "Tidak ada potensi tsunami" tidak berarti "aman". Gempa besar & dangkal dekat pantai → selalu ke tempat tinggi.\n' +
      '2. Penggabungan sumber konservatif: jika satu sumber memperingatkan tsunami, kami memperingatkan.\n' +
      '3. Framing jujur: ini notifikasi cepat, bukan peringatan dini.\n' +
      '4. Bahasa Indonesia, waktu WITA, nada tenang — hindari kelelahan peringatan.\n' +
      '5. Outlook adalah peluang meningkat, bukan ramalan dan bukan "aman".' +
      TAIL,
  },

  // 4 — GET INVOLVED
  {
    kicker: 'Bergabung',
    title: 'Tempat Anda bisa membantu',
    items: [
      { kind: 'para', text: 'Proyek komunitas non-profit & sumber terbuka. Untuk warga Sulawesi Tengah — dan siapa pun yang peduli — ada peran untuk setiap keterampilan:' },
      { kind: 'gap', h: 6 },
      { kind: 'dot', color: '#7FB7B8', lead: 'Pengembang', sub: 'Parser BMKG, bot berlangganan, jalur auto-publish Studio.' },
      { kind: 'dot', color: '#7FB7B8', lead: 'Penerjemah & desainer', sub: 'Salinan Indonesia yang tenang; brand kit & kartu.' },
      { kind: 'dot', color: '#7FB7B8', lead: 'Penyelenggara komunitas', sub: 'Edarkan ke keluarga, RT/RW, sekolah & kelompok siaga.' },
      { kind: 'dot', color: '#7FB7B8', lead: 'Seismolog & operator host', sub: 'Kalibrasi Outlook; jalankan loop selalu-aktif (Pi di Palu).' },
      { kind: 'gap', h: 12 },
      { kind: 'para', weight: 700, color: '#FBFCFB', text: 'Ikut: ' + GH },
    ],
    caption:
      'Mari bantu jaga Palu — caranya (4/4)\n\n' +
      'Proyek komunitas non-profit & sumber terbuka. Ada peran untuk setiap keterampilan:\n\n' +
      '• Pengembang — parser BMKG, bot berlangganan, auto-publish\n' +
      '• Penerjemah & desainer — salinan Indonesia, brand kit, kartu\n' +
      '• Penyelenggara komunitas — edarkan ke keluarga, RT/RW, sekolah\n' +
      '• Seismolog & operator host — kalibrasi Outlook, jalankan loop\n\n' +
      'Mulai di ' + GH + ' atau DM @infogempapalu.' +
      TAIL,
  },
];
