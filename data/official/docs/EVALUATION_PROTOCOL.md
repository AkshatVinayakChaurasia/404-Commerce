# Evaluation & Demo Protocol

## Overview (two stages)

| Stage | What | Who runs it | What participants submit |
|-------|------|-------------|---------------------------|
| **1. Backend / Holdout eval** | Automated scoring on secret scenarios | Organizers | JSONL predictions + (optional) Docker/API endpoint |
| **2. Live demo to judges** | Interactive product experience | Participants present | Working web app / UI + short pitch |

Stage 1 filters and ranks systems on **decision quality, groundedness, constraints**.  
Stage 2 lets judges **see the product** (UI, latency, localization, UX) and ask questions.

---

## Stage 1 — Backend holdout evaluation

### What is the holdout?

- **`eval/scenarios_holdout.csv`** — full file with `expected_action` / `expected_reason`  
  → **Organizers only.** Never distributed to participants.

- **`eval/scenarios_holdout_blind.csv`** — same scenarios, **labels stripped**  
  → Optional public release for a leaderboard phase or practice.  
  Participants must produce predictions without seeing the gold labels.

### Participant submission format (JSONL)

One line per scenario:

```json
{
  "scenario_id": "eval_edge_000",
  "action": "send" | "skip",
  "reason": "short grounded explanation",
  "offer": {
    "merchant_id": "m_001",
    "discount_pct": 15,
    "item_id": "optional",
    "final_price_inr": 170,
    "valid_minutes": 25
  },
  "notification": {
    "title": "...",
    "body": "...",
    "language": "hi-en",
    "cta": "Grab it"
  },
  "ui_hints": {
    "distance_m": 180,
    "walk_minutes": 3,
    "weather_note": "hot afternoon"
  },
  "profit_estimate_inr": 42.5
}
```

For `skip`, omit or null `offer` / `notification`; still provide `reason`.

### How organizers score

```bash
python eval/evaluator.py \
  --submission teamX_outputs.jsonl \
  --scenarios eval/scenarios_holdout.csv \
  --merchants data/merchants.csv \
  --customers data/customers.csv \
  --out eval/report_teamX.json
```

**Scoring dimensions (weighted):**

| Dimension | Weight | What is checked |
|-----------|--------|-----------------|
| Decision match | 30% | `action` matches expected `send` / `skip` |
| Groundedness | 25% | Merchant/item names & numbers exist in data; no hallucinated stock/hours |
| Constraint respect | 25% | Consent, open hours, max_discount, min_margin, distance sanity |
| Localization | 10% | Notification language matches customer preference |
| Profit awareness | 10% | Presence of a sensible `profit_estimate_inr` |

Overall score ∈ [0, 1]. Ties broken by groundedness then constraint.

### Optional API mode

If a team exposes an HTTP endpoint:

```
POST /decide
Content-Type: application/json

{ full scenario object from blind holdout }

→ returns the JSON object above
```

Organizers can batch-call the endpoint instead of requiring a static JSONL.  
Timeout recommendation: ≤ 8 s per scenario (including any LLM call).

---

## Stage 2 — Live demo & product presentation

After (or in parallel with) Stage 1, shortlisted teams present to judges.

### Required deliverables for the demo track

1. **Working web interface (or mobile web)**  
   - Judges (or a volunteer) can pick a public scenario **or** enter a live-like context (user, location, time, intent).  
   - System returns: decision (send/skip), offer card, generated notification text, distance/weather hints.  
   - Must clearly show that the offer is grounded (merchant name, discount %, price).  
   - Language / code-mix should be visible when the customer preference is non-English.

2. **Short pitch deck (PPT / PDF, ≤ 8–10 slides)**  
   Suggested structure:
   - Problem & moment (Priya’s Tuesday style)
   - Decision architecture (signals → rank → constraints → generate)
   - Demo screenshots or live walk-through
   - Groundedness / safety approach (consent, margin, no hallucination)
   - Optional: profit loop or online learning idea
   - Team & stack

3. **Optional but valued**  
   - Public demo URL or GitHub repo with README  
   - 60–90 s screen recording of the happy path  
   - Architecture diagram

### What judges look for in the live demo

- **Clarity of the decision** — why this merchant, this depth, or why skip  
- **UI quality** — is the notification something a real user would receive?  
- **Latency** — feels interactive (sub-3 s ideal; up to ~8 s acceptable with streaming)  
- **Localization** — natural hi-en / kn-en when requested  
- **Honesty** — system refuses or skips when constraints fire (consent off, closed, too far)  
- **Story** — can the team explain the commerce value (fill empty seats, protect margin)

Stage 1 score + Stage 2 qualitative score are combined for final ranking (exact weights set by organizers).

---

## Recommended participant workflow

1. Develop against **`data/scenarios_public.csv`** (labels available for self-debug).  
2. Build the decision + generative layers and a simple web UI.  
3. (Optional) Run predictions on **`eval/scenarios_holdout_blind.csv`** and submit JSONL for a public leaderboard.  
4. Submit final JSONL (or API) for private holdout scoring.  
5. Prepare PPT + live demo for the judging session.

---

## Hard rules (reminder)

- Do **not** train on or peek at `eval/scenarios_holdout.csv` (the labeled version).  
- Treat `marketing_consent = false` as a hard promotional block.  
- No third-party platform branding in outputs or UI.  
- All money in INR; all geo in Bengaluru.

This separation keeps automated evaluation objective while still requiring a real product surface that judges can experience.
