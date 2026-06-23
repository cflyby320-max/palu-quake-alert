// Evergreen educational content bank for Palu Earthquake Alerts.
//
// Authored ONCE from the Sulawesi Tengah content strategy (3 pillars). This is
// the single source studio renders from — captions are FINAL Indonesian prose
// (no runtime LLM in the default path), with qualified 2018 figures and the
// authoritative-routing + honest-framing lines baked in. Each post is a card
// (one slide) or a carousel (>1 slide). Append new topics freely.
//
// Pillars:
//   1  Kenali Wilayahmu      — historical facts & disaster literacy
//   2  Siap Sebelum Bencana  — low-cost, pre-decided preparedness
//   3  Saring Sebelum Sebar  — media literacy / anti-hoax
//   anniv                    — 28 Sep remembrance (P1 → P2 handoff)
//
// Safety (see CLAUDE.md + STUDIO_DESIGN.md §10): Bahasa Indonesia, calm tone,
// never an "all-clear"/prediction, qualified toll ("lebih dari 4.000"), and the
// honest-framing + BMKG/BNPB/BPBD routing on EVERY caption. `mustInclude` is the
// per-post safety assertion checked by validateEduCaption (educaption.js).

// Per-pillar accent band {bg, ink, bar} + the header chip label.
const ACCENT = {
  1: { tag: 'Kenali Wilayahmu', bg: '#0F6E56', ink: '#E1F5EE', bar: '#0A3742' },
  2: { tag: 'Siap Sebelum Bencana', bg: '#1D9E75', ink: '#04342C', bar: '#0A3742' },
  3: { tag: 'Saring Sebelum Sebar', bg: '#C77B0A', ink: '#412402', bar: '#7A4A06' },
  anniv: { tag: 'Mengenang 2018', bg: '#0A3742', ink: '#9FE1CB', bar: '#11343d' },
};

export const POSTS = [
  // ---- Pillar 1 — Kenali Wilayahmu -------------------------------------------
  {
    id: 'tiga-wajah-2018',
    pillar: 1,
    slot: 'Sen', // Senin (Mon) — P1 fact
    accent: ACCENT[1],
    slides: [
      {
        title: 'Tiga Wajah Bencana 2018',
        lines: [
          '28 September 2018 — gempa M7,5, dangkal.',
          'Satu gempa, tiga ancaman berbeda.',
          'Geser untuk mengenali ketiganya →',
        ],
      },
      {
        title: '1 · Guncangan',
        lines: [
          'Patahan Palu-Koro bergerak sangat cepat.',
          'Bangunan rusak dalam hitungan detik.',
          'Lindungi diri: merunduk & jauhi kaca.',
        ],
      },
      {
        title: '2 · Tsunami',
        lines: [
          'Teluk Palu yang sempit memperbesar gelombang.',
          'Gelombang mencapai sekitar 10 meter.',
          'Guncangan kuat di pesisir → naik ke tempat tinggi.',
        ],
      },
      {
        title: '3 · Likuefaksi',
        lines: [
          'Tanah berubah seperti lumpur mengalir.',
          'Balaroa, Petobo, Jono Oge tertimbun.',
          'Kenali zona rawan di sekitarmu.',
        ],
      },
    ],
    caption:
      'Bencana Palu 2018 bukan satu peristiwa, melainkan tiga ancaman sekaligus: ' +
      'guncangan gempa M7,5 yang dangkal, tsunami di Teluk Palu, dan likuefaksi yang ' +
      'mengubah tanah menjadi lumpur di Balaroa, Petobo, dan Jono Oge. Lebih dari 4.000 ' +
      'jiwa menjadi korban — angka pastinya masih berbeda antar sumber, jadi kita ' +
      'sebut "lebih dari 4.000" dengan hormat, bukan angka yang seolah pasti.\n\n' +
      'Memahami tiga wajah ini bukan untuk menakuti, tetapi agar kita tahu apa yang ' +
      'harus dilakukan saat bumi bergoncang.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Sumber resmi: BMKG (InfoBMKG), BNPB, ' +
      'dan BPBD Sulawesi Tengah.\n\n' +
      '#Palu #SulawesiTengah #gempa #tsunami #likuefaksi #mitigasibencana #BMKG',
    sources: [
      '2018 Sulawesi earthquake and tsunami — Wikipedia — https://en.wikipedia.org/wiki/2018_Sulawesi_earthquake_and_tsunami',
      'Liquefaction in Palu — Geoenvironmental Disasters — https://link.springer.com/article/10.1186/s40677-021-00194-y',
      'Source Model for the Tsunami Inside Palu Bay — GRL — https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019GL082717',
    ],
    mustInclude: [/lebih dari 4\.000/i, /likuefaksi/i, /BMKG/i],
  },
  {
    id: 'patahan-palu-koro',
    pillar: 1,
    slot: 'Sen',
    accent: ACCENT[1],
    slides: [
      {
        title: 'Patahan Palu-Koro',
        lines: [
          'Sesar geser yang melintasi lembah Palu.',
          'Bergerak ~30–40 mm per tahun —',
          'salah satu tercepat di Indonesia.',
          'Gempa 1927, 1968, 2018: sejarahnya nyata.',
        ],
      },
    ],
    caption:
      'Di bawah lembah Palu membentang Patahan Palu-Koro, salah satu sesar geser ' +
      'tercepat di Indonesia (sekitar 30–40 mm per tahun). Wilayah ini sudah ' +
      'mengalami gempa besar pada 1927, 1968, dan 2018 — sejarah seismiknya bukan ' +
      'kebetulan.\n\n' +
      'Mengetahui bahwa kita tinggal dekat sesar aktif bukan alasan untuk takut, ' +
      'tetapi alasan untuk menyiapkan rencana keluarga sejak sekarang.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Ikuti hanya sumber resmi: BMKG ' +
      '(InfoBMKG), BNPB, dan BPBD Sulawesi Tengah.\n\n' +
      '#PatahanPaluKoro #Palu #SulawesiTengah #gempa #mitigasibencana #BMKG',
    sources: [
      '2018 Sulawesi earthquake and tsunami — Wikipedia — https://en.wikipedia.org/wiki/2018_Sulawesi_earthquake_and_tsunami',
      '2018 Tsunamis (1968 history) — ITIC/IOC-UNESCO — https://legacy.itic.ioc-unesco.org/',
    ],
    mustInclude: [/Palu-?Koro/i, /BMKG/i],
  },

  // ---- Pillar 2 — Siap Sebelum Bencana ---------------------------------------
  {
    id: 'drop-cover-hold',
    pillar: 2,
    slot: 'Rab', // Rabu (Wed) — P2 action
    accent: ACCENT[2],
    slides: [
      {
        title: 'Saat Gempa: 3 Langkah',
        lines: [
          'MERUNDUK ke lantai sebelum terjatuh.',
          'LINDUNGI kepala & leher di bawah meja kokoh.',
          'BERPEGANGAN sampai guncangan berhenti.',
          'Mitos: berdiri di kusen pintu — tidak lebih aman.',
        ],
      },
    ],
    caption:
      'Saat gempa, lakukan tiga langkah ini: Merunduk, Lindungi kepala, Berpegangan ' +
      '(Drop, Cover, Hold On). Berlindunglah di bawah meja yang kokoh, jauhi kaca dan ' +
      'benda yang bisa jatuh. Berdiri di kusen pintu BUKAN cara yang lebih aman — itu ' +
      'mitos lama.\n\n' +
      'Latih gerakan ini bersama keluarga hari ini. Saat bumi bergoncang, tubuh yang ' +
      'sudah terlatih bergerak lebih cepat daripada pikiran yang panik — itu satu ' +
      'langkah kecil yang bisa menyelamatkan.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Ikuti arahan resmi BMKG, BNPB, dan ' +
      'BPBD Sulawesi Tengah.\n\n' +
      '#Merunduk #DropCoverHoldOn #siapsiaga #Palu #SulawesiTengah #mitigasibencana',
    sources: [
      'Drop, Cover, Hold On — public earthquake safety guidance',
      'Protect Your Life from Furniture Falling — Minoh City/MAFGA — https://portal.mafga.or.jp/en/archives/9154',
    ],
    mustInclude: [/merunduk/i, /berpegangan/i],
  },
  {
    id: 'tas-siaga',
    pillar: 2,
    slot: 'Rab',
    accent: ACCENT[2],
    slides: [
      {
        title: 'Tas Siaga Bencana',
        lines: [
          'Satu tas, siap diambil dalam hitungan detik.',
          'Cukup untuk bertahan mandiri ~3 hari.',
          'Geser untuk daftar isinya →',
        ],
      },
      {
        title: 'Isi Utama',
        lines: [
          'Air & makanan tahan lama (3 hari).',
          'Senter, radio, baterai, power bank.',
          'Obat pribadi & kotak P3K.',
        ],
      },
      {
        title: 'Jangan Lupa',
        lines: [
          'Salinan dokumen penting (plastik kedap air).',
          'Uang tunai secukupnya & peluit.',
          'Jaket, masker, alas kaki yang kuat.',
        ],
      },
      {
        title: 'Aturan 3 Hari',
        lines: [
          'Bantuan bisa terlambat datang.',
          'Siapkan kebutuhan mandiri 72 jam.',
          'Cek & ganti isi tas tiap 6 bulan.',
        ],
      },
    ],
    caption:
      'Tas siaga bencana adalah satu tas yang bisa kamu ambil dalam hitungan detik ' +
      'saat harus mengungsi. Isinya cukup untuk bertahan mandiri sekitar 3 hari ' +
      '(72 jam), karena bantuan tidak selalu datang cepat. Isi utama: air dan makanan ' +
      'tahan lama, senter, radio, baterai, power bank, obat pribadi, salinan dokumen ' +
      'dalam plastik kedap air, uang tunai, peluit, dan alas kaki yang kuat.\n\n' +
      'Satu langkah hari ini: siapkan tas ini dan letakkan dekat pintu. Periksa ' +
      'isinya tiap enam bulan.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Ikuti arahan resmi BMKG, BNPB, dan ' +
      'BPBD Sulawesi Tengah.\n\n' +
      '#TasSiaga #siapsiaga #Palu #SulawesiTengah #mitigasibencana #72jam',
    sources: [
      "Let's Get Prepared — Tokyo Metropolitan Government — https://www.bousai.metro.tokyo.lg.jp/book/pdf/en/02_Lets_Get_Prepared.pdf",
      'Is Your Bosai Bag Ready? (3-day rule) — JobsInJapan — https://jobsinjapan.com/living-in-japan-guide/is-your-bosai-bag-ready-essential-tips-for-disaster-preparedness-in-japan',
    ],
    mustInclude: [/tas siaga/i, /3 hari|72 jam/i],
  },

  // ---- Pillar 3 — Saring Sebelum Sebar ---------------------------------------
  {
    id: 'tidak-bisa-diprediksi',
    pillar: 3,
    slot: 'Jum', // Jumat (Fri) — P3 myth-bust
    accent: ACCENT[3],
    slides: [
      {
        title: 'Gempa Tidak Bisa Diprediksi',
        lines: [
          'Tidak ada teknologi mana pun yang bisa memastikan',
          'kapan, di mana, & sekuat apa gempa terjadi. — BMKG',
          'Pesan "gempa besok" = hoaks.',
          'Percaya hanya kanal resmi: InfoBMKG.',
        ],
      },
    ],
    caption:
      'BMKG menyatakan dengan tegas: sampai hari ini, tidak ada satu pun negara atau ' +
      'teknologi yang bisa memprediksi kapan, di mana, dan sekuat apa gempa akan ' +
      'terjadi. Maka setiap pesan berantai yang menyebut "akan ada gempa besar besok" ' +
      'atau mencantumkan tanggal dan kekuatan tertentu adalah hoaks.\n\n' +
      'Megathrust memang mungkin terjadi, tetapi waktunya tetap tidak bisa diprediksi. ' +
      'Jangan termakan isu — verifikasi dulu, dan percayai hanya kanal resmi InfoBMKG.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Sumber resmi: BMKG (InfoBMKG), BNPB, ' +
      'dan BPBD Sulawesi Tengah.\n\n' +
      '#GempaTidakBisaDiprediksi #lawanhoaks #CekFakta #BMKG #Palu #SulawesiTengah',
    sources: [
      'BMKG: Gempabumi Belum Dapat Diprediksi, Jangan Termakan Isu — BMKG — https://www.bmkg.go.id/siaran-pers/bmkg-gempabumi-belum-dapat-diprediksi-jangan-termakan-isu',
      'CekFakta (megathrust hoax) — Liputan6 — https://cekfakta.com/focus/32522',
    ],
    mustInclude: [/diprediksi/i, /hoaks/i, /BMKG/i],
  },
  {
    id: 'sift-sebelum-share',
    pillar: 3,
    slot: 'Jum',
    accent: ACCENT[3],
    slides: [
      {
        title: 'Saring Sebelum Sebar',
        lines: [
          'Sebelum forward, berhenti 30 detik.',
          '4 langkah SIFT untuk cek info viral.',
          'Geser →',
        ],
      },
      {
        title: 'Stop & Selidiki',
        lines: [
          'STOP — jangan langsung sebar.',
          'SELIDIKI sumbernya: siapa yang pertama mengunggah?',
        ],
      },
      {
        title: 'Cari & Telusuri',
        lines: [
          'CARI liputan lain yang lebih tepercaya.',
          'TELUSURI foto/klip ke konteks aslinya.',
          'Foto lama sering didaur ulang (Aceh 2004 → Palu).',
        ],
      },
      {
        title: 'Lalu Sebar',
        lines: [
          'Pesan berantai bisa picu kepanikan & penjarahan.',
          'Menyebarkan hoaks bisa berujung pidana.',
          'Verifikasi dulu, baru bagikan.',
        ],
      },
    ],
    caption:
      'Saat bencana, hoaks bisa menyebar lebih cepat daripada fakta. Sebelum ' +
      'membagikan, beri 30 detik untuk 4 langkah SIFT: Stop (berhenti sejenak), ' +
      'Selidiki sumbernya, Cari liputan lain yang tepercaya, dan Telusuri foto/video ' +
      'ke konteks aslinya. Pada 2018, foto korban tsunami Aceh 2004 dan klip lama ' +
      'sempat didaur ulang seolah-olah dari Palu.\n\n' +
      'Pesan "akan ada gempa susulan besar" dulu membuat warga meninggalkan rumah — ' +
      'dan rumah kosong rawan dijarah. Menyebarkan hoaks juga bisa berujung pidana. ' +
      'Maka: verifikasi dulu, baru bagikan.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Verifikasi ke kanal resmi: BMKG ' +
      '(InfoBMKG), BNPB, BPBD Sulawesi Tengah, serta CekFakta/Mafindo.\n\n' +
      '#SaringSebelumSebar #SIFT #lawanhoaks #CekFakta #Mafindo #Palu #SulawesiTengah',
    sources: [
      'Sulawesi tsunami: Indonesia battles fake news — The Guardian — https://www.theguardian.com/world/2018/oct/04/sulawesi-tsunami-indonesia-battles-fake-news-as-hoaxers-spread-panic',
      'Ini Hoax Terkait Tsunami Palu — Tempo.co — https://www.tempo.co/sains/ini-hoax-terkait-tsunami-palu-jumlah-korban-hingga-foto-fpi-810845',
      'The SIFT Method — UC Merced Library — https://libguides.ucmerced.edu/news/evaluation/sift-method',
    ],
    mustInclude: [/verifikasi/i, /hoaks/i, /BMKG/i],
  },

  // ---- Anniversary — 28 September --------------------------------------------
  {
    id: '28-september',
    pillar: 'anniv',
    slot: 'Sep-28',
    accent: ACCENT.anniv,
    slides: [
      {
        title: '28 September',
        lines: [
          'Mengenang gempa & tsunami Palu 2018.',
          'Lebih dari 4.000 jiwa — kita kenang dengan hormat.',
          'Cara terbaik mengenang: bersiap.',
        ],
      },
    ],
    caption:
      'Pada 28 September 2018, gempa M7,5 yang disusul tsunami dan likuefaksi mengubah ' +
      'Palu, Donggala, dan Sigi selamanya. Lebih dari 4.000 jiwa menjadi korban — kita ' +
      'mengenang mereka dengan hormat, bukan dengan angka yang seolah pasti.\n\n' +
      'Cara paling bermakna untuk mengenang adalah bersiap: periksa tas siaga, sepakati ' +
      'titik kumpul keluarga, dan latih langkah Merunduk–Lindungi–Berpegangan. Kita ' +
      'tidak bisa mencegah gempa, tetapi kita menentukan seberapa siap menghadapinya.\n\n' +
      'Notifikasi cepat — bukan peringatan dini. Ikuti arahan resmi BMKG, BNPB, dan ' +
      'BPBD Sulawesi Tengah.\n\n' +
      '#28September #Palu #SulawesiTengah #mengenang #siapsiaga #mitigasibencana',
    sources: [
      '2018 Sulawesi earthquake and tsunami — Wikipedia — https://en.wikipedia.org/wiki/2018_Sulawesi_earthquake_and_tsunami',
    ],
    mustInclude: [/lebih dari 4\.000/i, /bersiap|siaga|kesiapsiagaan/i],
  },
];

export function listPosts() {
  return POSTS.map((p) => ({ id: p.id, pillar: p.pillar, slot: p.slot, slides: p.slides.length }));
}

export function getPost(id) {
  return POSTS.find((p) => p.id === id) || null;
}
