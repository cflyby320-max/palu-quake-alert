# Topic Backlog Guide

Status: Phase 5B. This guide explains `topic_backlog.json`, the manual planning
layer for long-term civic education content.

## What It Is

`topic_backlog.json` is a reviewed list of educational topics that can later be
turned into validated render specs by the Phase 5 content engine. It is not a
posting queue, not a prompt bank, and not an automation trigger.

## Topic Fields

- `id`: stable lowercase identifier. Do not rename once used.
- `status`: `ready`, `draft`, `paused`, or `retired`.
- `priority`: `1` is highest-value evergreen content; `3` is lowest urgency.
- `pillarId`: one of the Design SDK pillar IDs.
- `contentType`: topic intent, aligned with approved template content types.
- `reuse_after_days`: minimum days before the topic should be reused.
- `last_used`: `YYYY-MM-DD` when a human-approved post was last used, or `null`.
- `approval`: must be `human_required`.
- `decision`: a Phase 5 content decision using `templateId`, `sourceIds`,
  `reviewStatus`, approved asset IDs, and structured `content`.

## Eligibility

`studio/topic-backlog.js` can select eligible topics for review. Eligibility is
planning-only and checks:

- the requested `status`, defaulting to `ready`;
- exact `priority` or a `maxPriority` threshold;
- optional `pillarId`;
- whether `last_used` is old enough for `reuse_after_days`.

The helper returns topic records. It does not render, post, call APIs, or update
`last_used`.

## Safety Rules

- Use `templateId`, never `layoutId` or `layout_id`.
- Ready topics must pass `buildRenderSpecFromContentDecision()`.
- Ready topics must use source IDs from `SOURCE_INDEX.json`.
- Emergency facts and Indonesian public-warning authority stay with BMKG.
- The mandatory honest-framing footer is never removed or rewritten.
- Do not publish all-clear language, prediction claims, or warning-status
  overrides.
- Assets must be approved IDs from `ASSET_INDEX.json`; do not bake factual text
  into images.

## Adding A Topic

1. Choose one pillar and one approved template.
2. Write concise Bahasa Indonesia copy in the selected template shape.
3. Add source IDs that a human reviewer can check.
4. Set `approval` to `human_required`.
5. Set `last_used` to `null` until a human-approved post is actually used.
6. Run the topic backlog tests before committing.

