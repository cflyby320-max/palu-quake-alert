// Offline tests for the studio evergreen (educational) track.
// PURE assertions on the SVG strings + captions (per STUDIO_DESIGN.md §12) — no
// rasteriser, no network — so this runs under `npm test` with the rest of the
// suite. The point is to enforce the safety invariants on every authored post.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { POSTS, listPosts, getPost } from '../studio/content/bank.js';
import { buildEduSvgs, buildEduCardSvg } from '../studio/edutemplate.js';
import { buildEduCaption, validateEduCaption } from '../studio/educaption.js';

test('bank has posts and getPost/listPosts agree', () => {
  assert.ok(POSTS.length >= 7, 'expected the first batch (~7 posts)');
  for (const meta of listPosts()) {
    assert.equal(getPost(meta.id).id, meta.id);
  }
});

test('every educational card carries the honest-framing footer + handle + pillar tag', () => {
  for (const post of POSTS) {
    const svgs = buildEduSvgs(post);
    assert.equal(svgs.length, post.slides.length, `${post.id}: one SVG per slide`);
    for (const svg of svgs) {
      assert.ok(svg.startsWith('<svg'), `${post.id}: is an SVG`);
      assert.match(svg, /bukan peringatan dini/i, `${post.id}: footer line 1`);
      assert.match(svg, /Selalu ikuti arahan resmi BMKG/i, `${post.id}: footer line 2`);
      assert.match(svg, /@infogempapalu/, `${post.id}: handle`);
      assert.ok(svg.includes(post.accent.tag), `${post.id}: pillar tag chip`);
    }
  }
});

test('carousel slides carry an n/N counter; single cards do not', () => {
  const carousel = getPost('tiga-wajah-2018');
  const svgs = buildEduSvgs(carousel);
  assert.match(svgs[0], /1\/4/);
  assert.match(svgs[3], /4\/4/);

  const single = getPost('drop-cover-hold');
  assert.equal(single.slides.length, 1);
  assert.ok(!buildEduSvgs(single)[0].includes('1/1'));
});

test('every authored caption passes the safety validator', () => {
  for (const post of POSTS) {
    assert.equal(buildEduCaption(post), post.caption, `${post.id}: buildEduCaption returns authored prose`);
    const v = validateEduCaption(post.caption, post);
    assert.ok(v.ok, `${post.id}: ${v.reason || 'failed validation'}`);
  }
});

test('validator rejects an all-clear claim', () => {
  const post = getPost('drop-cover-hold');
  const bad = post.caption + '\nKondisi sudah aman, tidak akan terjadi gempa lagi.';
  assert.equal(validateEduCaption(bad, post).ok, false);
});

test('validator rejects a false-precision 2018 toll', () => {
  const post = getPost('28-september');
  const bad = post.caption.replace('Lebih dari 4.000 jiwa', '4.340 orang tewas');
  assert.equal(validateEduCaption(bad, post).ok, false);
});

test('validator rejects a body missing a required mustInclude phrase', () => {
  const post = getPost('tidak-bisa-diprediksi');
  // Strip the word "hoaks" — should fail the post's mustInclude assertion.
  const bad = post.caption.replace(/hoaks/gi, 'kabar');
  assert.equal(validateEduCaption(bad, post).ok, false);
});

test('validator requires the BMKG routing line', () => {
  const post = getPost('tas-siaga');
  const bad = post.caption.replace(/BMKG/g, 'sumber');
  assert.equal(validateEduCaption(bad, post).ok, false);
});

test('buildEduCardSvg escapes nothing unsafe and renders a title', () => {
  const post = getPost('patahan-palu-koro');
  const svg = buildEduCardSvg(post.slides[0], post, { index: 0, total: 1 });
  assert.match(svg, /Patahan/);
});
