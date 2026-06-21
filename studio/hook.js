// The single entry point the watcher calls. Kept tiny and self-contained so
// src/monitor.js can `await import()` it lazily, behind a flag — that way the
// safety watcher imports and runs with ZERO dependencies when studio is off, and
// only touches the resvg dependency when a draft is actually being made.
//
// Called AFTER a family alert has already been delivered. Best-effort: the
// caller wraps this in try/catch, but we keep failures contained here too.

import { renderCard } from './render.js';
import { buildCaption } from './caption.js';
import { deliverDraft } from './deliver.js';

// m: a MergedEvent (the same object the watcher just alerted on).
export async function onAlert(m, { dryRun = false } = {}) {
  const { png, hadShakemap } = await renderCard(m);
  const caption = buildCaption(m);
  return deliverDraft({ png, caption, m, hadShakemap }, { dryRun });
}
