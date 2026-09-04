# Emoji Merge

Static 2048-style emoji evolution game served at `/emoji-merge/`.

## Product contract

- A visit is not a play. `emoji_merge_start` requires the first successful board move; `emoji_merge_progress` requires three successful moves.
- Completion is recorded only when the board has no legal move. Share is recorded only after the system share sheet or clipboard succeeds.
- Opening collection, history, daily challenge, theme, language, or chain controls never counts as play.
- Analytics events contain no score, chain, board, move, URL, language, or result values.
- The four related-game routes are curated and nested clicks are attributed.

## Incident state

Ad serving, interstitials, rewarded score paths, generic cross-promotion, fabricated rating markup, and synthetic engagement were removed during the invalid-traffic restriction that began 2026-09-03. Do not restore them without an evidence-backed review.

## Verify

From the workspace root:

```text
npm run verify:emoji-merge-suspension
node scripts/verify-emoji-merge-suspension.js --url https://dopabrain.com
```
