# X Community Notes — Contributor Eligibility & Progression

**Sources:**
- [Community Notes Guide — Signing Up](https://communitynotes.x.com/guide/en/contributing/signing-up)
- [Writing Ability (GitHub)](https://github.com/twitter/communitynotes/blob/main/documentation/contributing/writing-ability.md)
- [Writing Notes (GitHub)](https://github.com/twitter/communitynotes/blob/main/documentation/contributing/writing-notes.md)
- [Writing and Rating Impact (GitHub)](https://github.com/twitter/communitynotes/blob/main/documentation/contributing/writing-and-rating-impact.md)
- [Source: constants.py](https://github.com/twitter/communitynotes/blob/main/sourcecode/scoring/src/scoring/constants.py)
- [Source: contributor_state.py](https://github.com/twitter/communitynotes/blob/main/sourcecode/scoring/src/scoring/contributor_state.py)

## Sign-up requirements

Before becoming a Community Notes contributor (even just a rater):

- **Account age**: X account must be at least **6 months old**
- **No recent rule violations**
- **Verified phone number** from a trusted carrier, not connected to another CN account

## Progression: rater → writer

New contributors **start as raters only** and must earn writing ability.

| State | Description |
|---|---|
| `newUser` | Just signed up. Can only rate notes. Cannot write. |
| `earnedIn` | Reached Rating Impact threshold. Can write notes. |
| `atRisk` | Currently earned in, but 2 of last 5 notes rated "Not Helpful" (warning). |
| `earnedOutNoAcknowledge` | 3+ of last 5 notes "Not Helpful". Writing locked. |
| `earnedOutAcknowledged` | Writing locked, user acknowledged. |
| `removed` | Permanently removed. |

## Key thresholds (from constants.py)

| Constant | Value | Meaning |
|---|---|---|
| `ratingImpactForEarnIn` | **5** | Rating Impact needed to unlock writing |
| `isAtRiskCRNHCount` | 2 | "Not Helpful" notes (of last 5) to trigger "at risk" |
| `maxHistoryEarnOut` | 5 | Only last 5 notes evaluated for earn-out |
| `topWriterWritingImpact` | 10 | Writing Impact threshold for "top writer" |
| `topWriterHitRate` | 0.04 | 4% hit rate for "top writer" |

## Rating Impact calculation

```
ratingImpact = successfulRatingTotal - unsuccessfulRatingTotal - unsuccessfulRatingNotHelpfulCount
```

- **+1** for each rating matching the note's eventual status (before status assigned)
- **-1** for each opposing rating
- **Additional -1** for rating "Helpful" on a note that reaches "Not Helpful" (double penalty)

## Unlocking writing

A `newUser` transitions to `earnedIn` when `ratingImpact >= 5`.

## Losing writing ability

Writing is locked when either:
1. **3+ of last 5** finalized notes are rated "Not Helpful"
2. **0 or negative Writing Impact** AND any note reaches "Not Helpful"

## Re-earning after lockout

- **1st lockout**: Rating Impact must increase by **5** above current level
- **2nd lockout**: Must increase by **10** (escalating: `5 * N`)
- **Top writers** (WI >= 10, hit rate >= 4%): No escalation, always just +5

## Note writing rate limits (once unlocked)

**24-hour limit:**
- Negative Writing Impact: **1 note/day**
- Otherwise: `min(WritingImpact + 5, HitRate × 200)`
  - WI 0 → 5/day; WI 3, 20% HR → 8/day; WI 12, 20% HR → 17/day

**Per-author limit:**
- Initially 3 notes/24h on any single author
- After 6+ notes on a given author, limits tighten based on CRH rate

## Relevance to this project

Twitter's model is: **everyone starts as a rater, writing is earned through good rating behavior.** This is the opposite of letting anyone write notes immediately. Their key design insight is that rating quality (measured by Rating Impact) is the best predictor of writing quality.

For our simpler system, the analogous approach:
- Use the existing `reputation_score` as the gating metric for both rating and writing
- Writing threshold should be >= rating threshold (Twitter requires Rating Impact 5 for writing vs. 0 for rating)
- Consider a separate, higher threshold for writing (e.g., 50) vs. rating (25)
