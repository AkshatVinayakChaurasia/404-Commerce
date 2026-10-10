# AscenDex: PS-01 Commerce ("Priya's Tuesday")

AscenDex is a decision engine for hyperlocal offers. For one person at one moment, it decides whether
a nearby merchant should send an offer, which item to offer, how deep the discount should be, and
what the notification should say (in Hinglish by default). It returns **skip** when an offer would
only give margin away.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # guardrail check: 1,000 synthetic requests, target 0 violations
npm run presets    # print the six demo scenarios through the engine
npm run build      # production build
```

Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The Lab can then let
Claude write the copy. Every line still passes the grounding check, and the code falls back to a
template on timeout (5 s), refusal, or any number the engine didn't decide.

## Pages

| Route | What it shows |
|---|---|
| `/` | The story. The hero map is a real engine run for Priya's Tuesday. |
| `/lab` | **Decision Lab**, for judges. Each control calls `POST /api/solve` and renders the person checks, hard rules, score matrix, discount tiers, raw JSON and the copy prompt. |
| `/customer` | The notification and offer card as the person sees them. The layout is picked from a fixed set (`HeatOfferCard`, `RainOfferCard`, `LunchOfferCard`, `EveningOfferCard`). |
| `/merchant` | Brew & Bites owner view. Change the max discount or the offer window, re-run a simulated week, and compare. |

## API

`POST /api/solve`: the body follows the `Scenario` type in `lib/engine/types.ts`. Examples are in `samples/`.

```bash
curl -X POST localhost:3000/api/solve -H "content-type: application/json" --data @samples/priya-tuesday.json
```

The response contains `action` (`send` | `skip`), `reason`, `offer`, `notification`, `ui_configuration`,
`economics`, `trace` and `latency_ms`. Malformed input returns a safe skip and never a 500. Add
`?claude=1` to request Claude copy.

`POST /api/simulate` takes `{ n, seed, focus, overrides }` and returns the offline evaluation used by
`/merchant`.

## How a decision is made (`lib/engine/solve.ts`)

1. **Person checks.** Consent, location, time and weather must be present. Missing or `undefined`
   values cause a skip.
2. **Hard rules per merchant.** The merchant must be open now (including midnight-spanning hours and
   closed days) and inside the owner's offer window. It needs stock, a max discount of at least 5%, a
   walk of 15 minutes or less, and a round trip plus 10 minutes that fits the person's free time.
3. **Scoring.** The baseline purchase probability is a logistic function of taste, habit, walking
   minutes, rating and weather/time context. The weights live in `lib/engine/model.ts`.
4. **Discount.** Every 5% tier up to the owner's max is tried. Each tier's incremental profit is
   `p(d)·(price(1−d) − cost) − p₀·price·margin − send cost`. The best tier wins only if it clears ₹4;
   otherwise the engine skips. "Sure things" (high p₀) and "lost causes" both skip for this reason.
5. **Copy.** Template or Claude copy, then `checkGrounding()`: every number must be one the engine
   decided.

## Honest limits

- Merchants, people and the week are **synthetic** (`lib/data/koramangala.ts`). To use the official
  dataset, replace the exports in that file or map it to the `Scenario` contract.
- The simulator's response model is ours. It adds per-person noise that the engine can't see, but it
  is **not** the hackathon's hidden simulator. The UI labels these numbers as simulated.
- The model weights are starting hypotheses. Tune them once real outcomes are available.
