# Content Calendar

Status: Phase 5B planning workflow. This calendar is for manual topic planning
only. It does not render visuals, post content, call external APIs, or change
the earthquake alert pipeline.

## Purpose

The content calendar turns the Phase 5 content engine into a calm editorial
planning tool. It helps the operator choose what to prepare next from
`topic_backlog.json`, then review the content before any future render or
publishing step.

## Weekly Rhythm

Use a light rotation across the three civic education pillars:

- Week 1: Kenali Wilayahmu
- Week 2: Siap Sebelum Bencana
- Week 3: Saring Sebelum Sebar
- Week 4: repeat the highest-priority eligible topic or prepare a seasonal
  reminder

If a real earthquake or official BMKG update changes public attention, pause
planned education topics and keep emergency information routed to the existing
alert workflow.

## Monthly Review

Once per month:

- Check that each selected topic still matches its listed `sourceIds`.
- Confirm the footer framing remains mandatory and unchanged.
- Confirm no topic implies prediction, all-clear, or replacement of BMKG.
- Update `last_used` only after a human-approved post has actually been used.
- Keep reused topics spaced by `reuse_after_days`.

## Seasonal Prompts

These are planning prompts, not scheduled posts:

- Rainy season: preparedness items, family contacts, and safe routes.
- School periods: family meeting points and child-friendly action steps.
- September remembrance period: respectful safety learning, no disaster
  spectacle, no fear-based imagery.
- After a felt quake: only publish education if it will not confuse urgent
  official updates.

## Human Approval

Every topic remains `approval: "human_required"`. Topic selection only means
"worth reviewing next." It never means "ready to publish now."

Before any future render or post:

1. Re-check the source IDs.
2. Re-read the final text aloud in Bahasa Indonesia.
3. Confirm the mandatory footer and BMKG positioning.
4. Confirm the output is helpful without being alarmist.

