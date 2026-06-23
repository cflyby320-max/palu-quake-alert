# Educational content calendar — Sulawesi Tengah

The reviewable schedule for the studio's **evergreen** track. Posts are authored in
`studio/content/bank.js` (the machine-readable source studio renders from); this file is the
human view: what posts in which slot, with sources. Render any post with
`node studio/studio.js --edu <id> [--dry-run] [--llm]`.

Built from `sulawesitengahdisastercontentstrategy.md`. Three pillars, rotated weekly so the feed
balances **knowledge → action → discernment**:

- **P1 Kenali Wilayahmu** — historical facts & disaster literacy
- **P2 Siap Sebelum Bencana** — low-cost, pre-decided preparedness
- **P3 Saring Sebelum Sebar** — media literacy / anti-hoax

> Safety rules apply to every post (Bahasa Indonesia, calm, no all-clear/prediction, qualified
> 2018 toll "lebih dari 4.000", honest-framing footer + BMKG/BNPB/BPBD routing). Enforced in code
> by `validateEduCaption` and the tests in `test/studio_content.test.js`.

## Weekly rotation (Sen / Rab / Jum)

| Slot | Pillar | Post `id` | Format | Sources |
|---|---|---|---|---|
| Senin (Mon) | P1 | `tiga-wajah-2018` | Carousel ×4 | Wikipedia 2018 Sulawesi; Springer (likuefaksi); GRL (tsunami) |
| Senin (alt) | P1 | `patahan-palu-koro` | Card | Wikipedia 2018 Sulawesi; ITIC (1968) |
| Rabu (Wed) | P2 | `drop-cover-hold` | Card | Drop-Cover-Hold guidance; MAFGA furniture |
| Rabu (alt) | P2 | `tas-siaga` | Carousel ×4 | Tokyo Metropolitan bosai bag; JobsInJapan (3-day) |
| Jumat (Fri) | P3 | `tidak-bisa-diprediksi` | Card | BMKG press release; CekFakta |
| Jumat (alt) | P3 | `sift-sebelum-share` | Carousel ×4 | The Guardian; Tempo (hoaks); UC Merced (SIFT) |

## Calendar hooks

| Date | Post `id` | Pillar lead |
|---|---|---|
| **28 Sep** — anniversary of the 2018 Palu earthquake-tsunami | `28-september` | P1 (remember) → P2 (act) |

(Future hooks to author: Sep 1 drill day, Oct 13 Intl. DRR Day, Nov 5 World Tsunami Awareness Day.)

## Out of studio's scope — manual / external production

Studio renders **static cards + carousels** only. The strategy's video/interactive sub-themes are
**not** generated here — produce them manually or with other tools, then post by hand:

- Liquefaction jar demo, fault animation, "60 seconds of Palu's seismic history" (Reels/Shorts).
- Drop-Cover-Hold drill video; furniture-strapping demo.
- Smong / Kamaishi mini-docs (story-driven video).
- Reverse-image-search tutorial (screen recording); real-vs-fake quiz (Stories).

## Ready to author next (already structured for the bank)

Furniture anchoring ("Ikat lemari hari ini"), family timeline / titik kumpul, Smong heritage,
Kamaishi kids, "Remember this hoax?" 2018 case studies (Bili-Bili dam, fake M8.1, recycled Aceh
photos), trusted-accounts directory.
