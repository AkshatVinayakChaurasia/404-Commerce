# Decisioned Offer System — Participant Guide

## Problem in one sentence
Build a system that decides **whether**, **what**, and **how deep** an offer should be for a specific user + merchant + moment, then generates a grounded, localized notification / UI, and can close the loop on simulated profit.



## How you will be evaluated (two stages)

### Stage 1 — Automated holdout (backend)

- Organizers run your predictions against a **secret labeled holdout** (`eval/scenarios_holdout.csv` — you never see the labels).
- You may optionally receive a **blind** version (`eval/scenarios_holdout_blind.csv`) with the same scenarios but **no expected answers**, for practice or a public leaderboard.
- Submit either:
  - a **JSONL file** (one prediction object per scenario), or
  - an **HTTP endpoint** `POST /decide` that accepts a scenario and returns the same JSON shape.
- Scoring: decision match, groundedness, constraint respect, localization, profit awareness.  
  See `docs/EVALUATION_PROTOCOL.md` for exact weights and the evaluator command.

### Stage 2 — Live demo to judges (frontend + pitch)

After the backend filter, shortlisted teams show a **working product**:

1. **Web (or mobile-web) interface**  
   Judges pick a public scenario or enter a live-like context and see the decision + generated offer card / notification in real time.

2. **Pitch deck (PPT/PDF, ≤ 8–10 slides)**  
   Problem → architecture → demo → safety/groundedness → team.

3. **Optional**: public demo URL, GitHub repo, 60–90 s screen recording.

Judges score UX, clarity of decision, localization, latency, and honesty on edge cases (consent off, closed, far away).  
Stage 1 + Stage 2 scores are combined for the final ranking.

Full details: **`docs/EVALUATION_PROTOCOL.md`**.


## What you receive

| File | Purpose |
|------|---------|
| `data/customers.csv` | 350 synthetic users (location, wallet, language, signals, visit history, consent) |
| `data/merchants.csv` | 100 merchants (geo, capacity, occupancy, max discount, margin floor, objective, inventory signal) |
| `data/catalog_items.csv` | Items linked to merchants (price, stock, prep time) |
| `data/static_offers.csv` | Pre-existing static offers some merchants already run |
| `data/weather_hourly.csv` | 7-day hourly weather for Bengaluru |
| `data/festivals.csv` | Seasonal / event windows (Diwali, Holi, IPL, monsoon, …) |
| `data/scenarios_public.csv` | Public test scenarios you can develop and demo against |
| `eval/scenarios_holdout.csv` | **Organizer-only** held-out scenarios (do not train on these) |
| `manifest.json` | Dataset version and counts |

All coordinates are in Bengaluru. Timezone is Asia/Kolkata (+05:30).

## Required system behaviour

1. **Decision layer**  
   Using user signals (location, wallet, time available, language, consent, churn, preferences), merchant rules (max discount, margin, occupancy, open hours, objective), weather, and any active festival:
   - Decide `send` or `skip`
   - If send: choose discount depth (0 … max_discount_pct) that respects margin
   - Prefer nearby merchants (haversine < ~1.2 km for lunch windows is a good default)

2. **Generative UI layer**  
   Produce a short notification / card that is:
   - Grounded in the actual offer numbers and merchant name
   - Localized to the user’s `language` (en / hi-en / kn-en / …) with natural code-mix where appropriate
   - Free of hallucinated inventory, false urgency, or claims the merchant did not authorize
   - Respectful of `marketing_consent = false` → never send promotional content

3. **Close the loop (optional but scored)**  
   Simulate acceptance probability from relevance + distance + discount + timing, then estimate merchant contribution (price − cost − discount) × accept rate. Track cumulative profit across a batch of scenarios.

## Expected output format (per scenario)

```json
{
  "scenario_id": "cur_001",
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

For `skip`, omit or null the `offer` and `notification` fields; still provide `reason`.

## Evaluation criteria (organizers)

- **Groundedness** — numbers and names exist in the data; no invented stock or hours
- **Constraint respect** — consent, open hours, max discount, min margin, distance sanity
- **Relevance** — offer matches intent, weather, festival, and user signals
- **Localization quality** — natural language for the declared preference
- **Decision quality** — sensible send/skip on edge cases (consent=false, closed, far away, empty wallet)
- **Profit awareness** — systems that can estimate contribution are ranked higher on the commerce track

A lightweight evaluator script is provided under `eval/`. Organizers run it against your submitted JSONL of outputs on the holdout set.

## Suggested development path

1. Load CSVs, implement haversine + open-hours check + margin guard.
2. Build a simple deterministic ranker (distance + occupancy gap + wallet fit).
3. Add generative layer (LLM or template + few-shot) constrained by the decision output.
4. Run on `scenarios_public.csv`, inspect failures, iterate.
5. Package a single entrypoint that reads a scenario id (or batch) and emits the JSON above.

## Hard rules

- Do not use or mention any third-party platform brand names.
- Do not train on or look at `eval/scenarios_holdout.csv` if you are a participant.
- All monetary values are INR.
- Treat `marketing_consent = false` as a hard block for promotional sends.

Good luck. Build something that feels like it was made for that exact Tuesday at 1:15 PM.
