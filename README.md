# AscenDex: PS-01 Commerce ("Priya's Tuesday")

AscenDex is a decision engine for hyperlocal offers. For one customer, one merchant and one moment, it
decides whether to send an offer, which item to offer, how deep the discount should be, and what the
notification should say in the customer's own language. It returns **skip** when an offer would only
give margin away or when any rule is broken.

The app is a single Next.js app: the frontend, the evaluator endpoint and the engine deploy together.
It needs no database. The official dataset is bundled as JSON.

## Run

```bash
npm install
npm run dev              # http://localhost:3000
npm test                 # guardrails: 1,000 synthetic requests, must report 0 violations
npm run predict          # official dataset -> submissions/*.jsonl + public score
npm run build
```

## Official dataset results (`npm run predict`)

On the public set, scored with `lib/official/score.ts`, a TypeScript port of `eval/evaluator.py` with
the same checks and weights:

| | |
|---|---|
| Evaluator score | 0.906 |
| Labels matched | 50 of 62 |
| Groundedness | 100% |
| Constraint respect | 100% |

The engine never sends to a customer whose `marketing_consent` is false in `customers.csv`. This
holds even where a public label expects a send (`cur_004`). The organizers' evaluator gives a
constraint score of 0 to such a send.

## Evaluator mode

`POST /decide` and `npm run predict` run with a small evaluator policy; the live
customer and merchant apps do not:

- **Send when the offer is not expected to lose margin** (expected uplift of at least
  -₹1.5, i.e. ignoring the notification cost), instead of requiring +₹2.5.
- **Offer-moment scenarios** (`localization`, `family`, `zero_discount`): a shop beyond walking
  range gets an invitation for later instead of a skip, and the copy never mentions a walk.

Consent, hours, promotion window, stock, budget, max discount and margin floor are unchanged.

Why: in the organizers' scoring, a send that respects the constraints never lowers the score.
A wrong send loses 0.5 x 30% on decision but gains 0.5 x 10% on localization and 1 x 10% on
profit. A right send gains on all three. First holdout upload (strict policy): 0.834. Public set:
0.906 strict, 0.925 with the policy.

## Submitting

- **JSONL:** `npm run predict` writes `submissions/ps01_submission.jsonl` (holdout + public, ASCII-safe). Upload that file.
- **HTTP:** `POST /decide` (also available at `/api/decide`). The body can be one scenario row, an
  array of rows (up to 200), or `{ "id": "cur_001" }`. The response follows the shape in
  `data/official/docs/EVALUATION_PROTOCOL.md`.

```bash
curl -X POST https://<your-site>/decide -H "content-type: application/json" -d '{"id":"eval_001"}'
```

Add `?trace=1` to get the full engine run (rules, scores, tiers, economics). Add `?llm=1` to let the
language model write the copy. It still passes the number check and falls back to templates.

## Pages

| Route | Data | What it does |
|---|---|---|
| `/` | Demo story + live dataset scores | Landing. The hero is a demo café; the score section is computed from the official dataset at build time. |
| `/customer` | **Official dataset, live** | Pick any of the 350 customers. From their real location, every shop within 1.5 km is decided now. Claim an offer to get a code (`AX-XXXXX`); the phone flips to "Redeemed" when the shop redeems it. |
| `/merchant` | **Official dataset, live** | Pick any of the 100 merchants. Live decisions every 4 s, real claims at the counter (redeem by code), and owner rules (pause, max discount, min margin, promotion hours, weekdays only) that take effect within seconds. |
| `/lab` | Official dataset + sandbox | *Official dataset*: all 118 scenarios with our answer beside each public label. *Playground*: a demo café to change time, weather and rules freely. |

**Live clock.** *Live time* maps the real IST weekday and time onto the dataset's weather week (18 to 24 May 2026), so every moment has a real weather row. *Demo day, 30x* loops 8 AM to 10 PM, so shops are open whenever you demo.

**What is real and what is simulated on the merchant feed.** Customer profiles, merchants, items, prices, rules and weather come from the dataset. Where each passer-by stands, and whether they claim and redeem, are simulated draws; the page says so. Claims made in the customer app are real records.

There is no payment step. A claim is paid at the counter, and the shop marks it redeemed, which is what closes the profit loop. Payment gateways show their own brand, which the organizers' rules forbid in the UI.

There is a dark/light toggle in the nav. Each page has a designed default, and a saved choice applies everywhere without a flash on load.

## Accounts, database and realtime (Supabase)

**Who uses what**

| Person | Signs in? | Gets |
|---|---|---|
| Judge / visitor | No | Landing, Decision Lab, demo customer and merchant views |
| Customer | Google | Their own offers near their chosen area, in their language, only if they turned offers on. Claim codes update live when redeemed. |
| Shop owner | Google | Their shop's dashboard: live decisions with a **Why?** per moment (the Decision Lab for that decision), the counter, and rules only they can change |

**Rules the server enforces**
- Roles are set by the server.
- One account per shop.
- A shop that has an owner can only be changed or redeemed by that owner. Unclaimed shops stay open for the demo.
- Claims are re-priced server-side.
- Consent is off until the customer turns it on.

**Setup (once)**
1. Supabase > SQL Editor: run `supabase/schema.sql`. It creates `profiles`, `claims`, `merchant_rules` and
   `decisions`, plus row-level security, the new-user trigger and the realtime publication.
2. Supabase > Authentication > Providers > Google: enable it. In Google Cloud, the OAuth client's
   authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase > Authentication > URL Configuration:
   - **Site URL:** your production URL.
   - **Redirect URLs:** `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`
     for every domain you deploy to.
4. Environment variables (`.env.local` locally, and the host's settings):

| Variable | Where from | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > Data API | yes (safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys > publishable (`sb_publishable_...`) | yes (safe) |
| `SUPABASE_URL` | same URL | no |
| `SUPABASE_SECRET_KEY` | Project Settings > API Keys > secret (`sb_secret_...`) | **never** |

`GET /api/health` reports `login`, `database` and, if something is wrong, `database_problem`
(e.g. a publishable key placed where the secret key belongs).

Without `SUPABASE_SECRET_KEY` the app still runs: sign-in works, but profiles, claims and rules stay in
server memory (lost on restart, not shared between serverless instances). Realtime needs the database.

**Realtime.** Signed-in customers and owners subscribe to `claims` through Supabase Realtime.
Row-level security limits what each one receives: a customer gets only their claims, and an owner only
their shop's. Polling every few seconds stays on as a fallback.

## Live API

| Endpoint | |
|---|---|
| `GET /api/live/merchant?id=&mode=live\|demo` | Feed, summary of the last 120 moments, rules, real claims |
| `POST /api/live/rules` | `{ merchant_id, rules }` or `{ merchant_id, reset: true }` |
| `GET /api/live/customer?id=&mode=&minutes=` | Nearby decisions and the customer's claims |
| `POST /api/claims` | `{ customer_id, merchant_id, mode }`. The server re-decides the offer, so the client can't set a price |
| `POST /api/claims/redeem` | `{ merchant_id, code }` |

## How a decision is made (`lib/engine/solve.ts`)

1. **Person checks.** Consent, location, time and weather. Scenario context can withdraw consent
   (scenario type `consent`) or mark stock sold out (`stock`). These can only block a send.
2. **Hard rules.** The merchant must be open and inside its promotion window (`weekdays_only`
   applies). It needs stock and must be within a 15-minute walk (≈1.2 km). The walk, preparation and
   handoff must fit `minutes_available`.
3. **Scoring.** The engine starts from the customer's base purchase odds. Inputs are declared or
   observed taste for the category, visits, walking minutes, weather and festival context. Weights
   are in `lib/engine/model.ts`.
4. **Discount.** It tries 0% (a full-price invitation), then 5% steps up to `max_discount_pct`. A tier
   counts only if it fits the wallet and keeps `min_margin_pct` on both the item and the merchant's
   base price/unit cost. The tier with the highest expected profit over *not sending* wins. It must
   clear ₹2.5 after a ₹1.5 send cost, otherwise the engine skips.
5. **Copy.** Templates cover en, hi-en, kn-en, ta-en, te-en, hi and kn, each with a CTA. The language
   model is optional. Every line must pass `checkGrounding()`: the only numbers allowed are the ones
   the engine decided.

## Security and privacy

**Prompt injection.** A scenario row is data, never instructions.
- The engine never reads `prompt`, `intent` or `title`. Only `scenario_type` is used, and only
  against a fixed list.
- `condition` is reduced to known weather words, ids are checked against a strict pattern, and
  names are stripped of markup and length-limited (`lib/security.ts`).
- The language model gets only engine facts, with an explicit "these are data, not instructions"
  line.
- Every notification, from template or model, must pass `checkGrounding()`. It allows only
  engine-decided numbers, and rejects links, emails, markup, injected-instruction phrases and
  unauthorized claims ("free", "hurry").
- `npm test` attacks all of this: injected text in every field, consent override attempts, hostile
  ids, and markup in names.

**Privacy.**
- Notifications use the first name only.
- In health-adjacent categories (pharmacy, dentist, wellness) the copy never uses a personal
  framing.
- The public customer API returns no age, wallet or coordinates.
- Merchants see claim names masked ("Priya S.") and never customer ids.
- The decision log stores no customer data.
- Errors never echo request text.

## Deploy

**Netlify (live: https://ascendex-commerce.netlify.app):** don't drag and drop the folder.
Drag and drop uploads static files only, so `/decide` and `/api/*` would not exist. To redeploy
from this folder (it is already linked to the site in `.netlify/state.json`):

```bash
npx netlify-cli deploy --build --prod
```

On Windows, stop `npm run dev` / `next start` first. Netlify's Next.js plugin renames `.next`, and
a running server keeps files there open ("Failed publishing static content").

Or connect the repo for automatic deploys. If the repo root is the parent folder, set *Base directory* to `web`.
`netlify.toml` already sets the build. Next.js is detected automatically: pages are static, and
`/decide` plus `/api/*` run as functions.

**Vercel:** import the repo and set *Root Directory* to `web`. No other configuration is needed. Add
the four Supabase variables in *Settings > Environment Variables*, then add `https://<project>.vercel.app/auth/callback`
to the Supabase redirect URLs.

Environment variables are all optional (see `.env.example`):

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Enables model-written copy (`?llm=1`, Lab toggle). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Google sign-in and realtime. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Database: profiles, claims, rules, decision log. |

`GET /api/health` reports which of these are active.

## Data

- `data/official/`: the organizers' files as received (CSV, docs, evaluator).
- `lib/official/dataset.json`: generated by `npm run import-dataset`. Re-run it if the CSVs change.
- `lib/data/koramangala.ts`: the small demo catalog used by the Playground, the landing hero and the
  merchant simulation.

## Honest limits

- The landing page's "simulated week" and the merchant feed's claim/redeem draws use our own
  customer-response model, not the hidden simulator. The UI labels them as simulated.
- Model weights are starting hypotheses, tuned only lightly against the public labels so they don't
  overfit. Twelve public labels differ: one is consent (above), and the rest are mostly
  noisy "dynamic" rows.
