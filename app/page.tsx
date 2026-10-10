import Link from "next/link";
import { Nav } from "@/components/nav";
import { HeroScene } from "@/components/hero-scene";
import { ProfitChart } from "@/components/profit-chart";
import { MERCHANTS, presetById } from "@/lib/data/koramangala";
import { decide, type Decision } from "@/lib/engine/solve";
import { checkGrounding, templateCopy } from "@/lib/engine/copy";
import { simulate } from "@/lib/engine/simulate";
import type { Notification } from "@/lib/engine/types";
import { clock, inr, pct, shortFail } from "@/lib/format";
import { scorePublic } from "@/lib/official/score";
import { dataset } from "@/lib/official/adapter";

function pinsFor(d: Decision) {
  return MERCHANTS.map((m) => {
    const g = d.trace.gates.find((x) => x.merchant_id === m.id);
    const fail = g?.checks.find((c) => !c.ok);
    if (fail) return { id: m.id, name: m.name, location: m.location, label: shortFail(fail.rule, fail.detail), tone: "bad" as const };
    if (d.offer?.merchant_id === m.id)
      return { id: m.id, name: m.name, location: m.location, label: `${d.offer.discount_pct}% off ${d.offer.item_name}`, tone: "accent" as const };
    const likely = Math.max(0, ...d.trace.candidates.filter((c) => c.merchant_id === m.id).map((c) => c.p_base));
    return {
      id: m.id,
      name: m.name,
      location: m.location,
      label: likely >= 0.6 ? "she goes anyway" : "less profit",
      tone: "muted" as const,
    };
  });
}

export default async function Home() {
  const priyaScenario = presetById("priya-tuesday").build();
  const priya = decide(priyaScenario);
  const arjunScenario = presetById("the-regular").build();
  const arjun = decide(arjunScenario);
  const sim = simulate({ n: 600 });
  const { score } = await scorePublic();
  const languages = new Set(dataset.customers.map((c) => c.language)).size;

  const copy = priya.facts ? templateCopy(priya.facts) : { title: "", body: "", cta: "" };
  const grounded = priya.facts ? checkGrounding(copy, priya.facts).ok : false;
  const notification: Notification = { ...copy, language: "hi-en", source: "template", grounded };
  const offer = priya.offer!;
  const econ = priya.economics!;
  const stage = (id: string) => priya.trace.stages.find((s) => s.id === id)?.summary ?? "";
  const arjunTop = [...arjun.trace.candidates].sort((a, b) => b.p_base - a.p_base)[0];
  const arjunVisits = arjunScenario.user.visits?.[arjunTop.merchant_id] ?? 0;
  const chosenMax = MERCHANTS.find((m) => m.id === priya.offer?.merchant_id)?.max_discount_pct ?? 0;
  const arjunMax = MERCHANTS.find((m) => m.id === arjunTop.merchant_id)?.max_discount_pct ?? 0;

  const steps = [
    {
      title: "Check the rules",
      body: "Consent, opening hours, the owner's offer window, stock, walking distance and the person's free time. Fail one and the merchant is out.",
      fact: stage("constraints"),
    },
    {
      title: "Score every item",
      body: "Taste for the category, how often they already come, minutes of walking, and what the weather does to the craving.",
      fact: stage("score"),
    },
    {
      title: "Pick the discount",
      body: "Try every tier up to the owner's maximum. Keep the one that adds the most profit over not sending at all, or skip.",
      fact: stage("price"),
    },
    {
      title: "Write the message",
      body: "Hinglish copy from the engine's facts only. Any number the engine didn't decide fails the check and falls back to a template.",
      fact: grounded ? "Every number in the message matches the engine" : "Message failed the check",
    },
  ];

  const never = [
    "Message someone who hasn't opted in",
    "Offer something from a closed shop or a sold-out shelf",
    "Go past the owner's maximum discount, or default to it",
    "Let the language model invent a price, distance or item",
    "Make the caller wait: copy falls back to a template after 5 seconds",
  ];

  return (
    <div className="theme-dark min-h-dvh bg-bg text-text">
      <Nav theme="dark" />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pt-14">
          <div>
            <h1 className="display text-[clamp(44px,6.4vw,84px)]">
              <span className="block whitespace-nowrap">Right offer.</span>
              <span className="block whitespace-nowrap">Right moment.</span>
              <span className="block whitespace-nowrap">Or none at all.</span>
            </h1>
            <p className="mt-7 max-w-[52ch] text-[18px] text-muted">
              AscenDex decides, for one person at one minute, whether a Koramangala merchant should send an offer:
              which item, how deep a discount, and what to say. It skips when the offer would only give margin away.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/lab" className="rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.97]">
                Open the Decision Lab
              </Link>
              <Link href="/customer" className="rounded-full border border-line-strong px-6 py-3.5 text-[16px] font-medium transition-colors hover:bg-surface">
                See Priya&apos;s phone
              </Link>
            </div>
            <p className="mt-10 max-w-[48ch] text-[14px] text-muted">
              Priya, 26, has {inr(priyaScenario.user.wallet_inr ?? 0)} in her wallet and lunch ends at{" "}
              {clock(priyaScenario.user.free_until ?? "13:35")}. Brew &amp; Bites, two minutes away, wants its empty
              seats filled between 1 and 3 PM.
            </p>
          </div>

          <HeroScene
            user={priyaScenario.user.location}
            pins={pinsFor(priya)}
            gates={priya.trace.gates}
            offer={offer}
            notification={notification}
            clockLabel="Tuesday 1:15 PM"
            weatherLabel={`${priyaScenario.context.weather.temp_c}°C`}
          />
        </section>

        {/* How */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8">
            <h2 className="title max-w-[22ch] text-[clamp(30px,3.6vw,44px)]">How one decision is made, in under a millisecond</h2>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col bg-bg p-6">
                  <span className="text-[15px] font-semibold text-accent-text">{i + 1}</span>
                  <h3 className="title mt-3 text-[21px]">{s.title}</h3>
                  <p className="mt-2 text-[15px] text-muted">{s.body}</p>
                  <p className="mt-auto border-t border-line pt-4 text-[14px]">
                    <span className="text-muted">For Priya: </span>
                    {s.fact}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pair */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8">
            <h2 className="title text-[clamp(30px,3.6vw,44px)]">Same café, same minute</h2>
            <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
              Priya and Arjun sit in the same building. At 1:15 one of them gets an offer. Both decisions protect the
              café&apos;s margin.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="title text-[24px]">Priya</h3>
                  <span className="rounded-full bg-accent-tint px-3 py-1 text-[14px] font-semibold text-accent-text">
                    Send {offer.discount_pct}% off
                  </span>
                </div>
                <p className="mt-4 text-[17px] font-semibold">{notification.title}</p>
                <p className="mt-1 text-[16px] text-muted">{notification.body}</p>
                <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
                  <Stat label="Buys without an offer" value={pct(econ.p_base)} />
                  <Stat label={`Buys with ${offer.discount_pct}% off`} value={pct(econ.p_offer)} />
                  <Stat label="Expected extra profit" value={inr(econ.incremental_profit, 1)} accent />
                </dl>
                <p className="mt-5 text-[14px] text-muted">
                  The owner allows up to {chosenMax}%. The engine stopped at {offer.discount_pct}% because deeper discounts add
                  buyers but lose more margin than they win.
                </p>
              </article>

              <article className="rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="title text-[24px]">Arjun</h3>
                  <span className="rounded-full bg-bad-tint px-3 py-1 text-[14px] font-semibold text-bad">Skip</span>
                </div>
                <p className="mt-4 text-[17px] font-semibold">No notification</p>
                <p className="mt-1 text-[16px] text-muted">{arjun.reason}</p>
                <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
                  <Stat label="Buys without an offer" value={pct(arjunTop.p_base)} />
                  <Stat label="Visits this week" value={String(arjunVisits)} />
                  <Stat label="Discount given" value={inr(0)} accent />
                </dl>
                <p className="mt-5 text-[14px] text-muted">
                  A coupon tool would send him {arjunMax}% off the {arjunTop.item_name.toLowerCase()} he was already walking
                  over to buy.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Official dataset */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="title text-[clamp(30px,3.6vw,44px)]">On the organizers&apos; dataset</h2>
                <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
                  {dataset.scenarios_public.length} public scenarios, {dataset.merchants.length} Bengaluru merchants,{" "}
                  {dataset.customers.length} customers. Scored with a line-by-line port of the official evaluator, computed
                  when this page was built.
                </p>
              </div>
              <Link href="/lab" className="self-start rounded-full border border-line-strong px-5 py-3 text-[15px] font-medium transition-colors hover:bg-surface md:self-auto">
                Browse every scenario
              </Link>
            </div>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              <Big label="Evaluator score" value={score.overall.toFixed(3)} note="weighted, out of 1.000" accent />
              <Big label="Decisions matching the label" value={`${score.matched} of ${score.n}`} note="send or skip" />
              <Big label="Constraint respect" value={pct(score.constraint)} note="consent, hours, max discount, margin" />
              <Big label="Grounded notifications" value={pct(score.groundedness)} note={`in ${languages} languages and code-mixes`} />
            </dl>
            <p className="mt-5 max-w-[80ch] text-[13px] text-muted">
              Where we differ from a label, the Lab shows why. The engine sends nothing to customers the data marks as
              opted out, even when a label expects a send.
            </p>
          </div>
        </section>

        {/* Week */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="title text-[clamp(30px,3.6vw,44px)]">A simulated week in Koramangala</h2>
              <p className="mt-4 max-w-[46ch] text-[17px] text-muted">
                {sim.n} synthetic moments, three ways to answer them. The line is the extra profit merchants make
                over sending nothing.
              </p>
              <dl className="mt-8 space-y-5">
                <Row label="AscenDex" value={`${inr(sim.totals.engine.profit)} from ${sim.totals.engine.sent} offers`} accent />
                <Row label="Max discount to the best match" value={`${inr(sim.totals.max_discount.profit)} from ${sim.totals.max_discount.sent} offers`} />
                <Row label="Skipped by AscenDex" value={`${sim.n - sim.totals.engine.sent} moments`} />
              </dl>
              <p className="mt-8 max-w-[52ch] text-[13px] text-muted">
                Simulated with our own customer-response model, which adds per-person noise the engine can&apos;t see.
                It is not the hackathon&apos;s hidden simulator, and these are not real sales.
              </p>
            </div>
            <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-6">
              <ProfitChart
                x={sim.series.map((p) => p.i)}
                xLabel="Requests"
                series={[
                  { key: "engine", label: "AscenDex", color: "var(--accent)", values: sim.series.map((p) => p.engine) },
                  { key: "max", label: "Max discount", color: "var(--muted)", dash: "6 6", values: sim.series.map((p) => p.max_discount) },
                  { key: "none", label: "No offers", color: "var(--line-strong)", values: sim.series.map((p) => p.none) },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Never */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-2">
            <h2 className="title max-w-[16ch] text-[clamp(30px,3.6vw,44px)]">What it will never do</h2>
            <ul className="divide-y divide-line border-y border-line">
              {never.map((n) => (
                <li key={n} className="flex items-start gap-4 py-4 text-[17px]">
                  <svg width="20" height="20" viewBox="0 0 20 20" className="mt-1 shrink-0 text-bad" aria-hidden="true">
                    <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-6 px-4 py-20 sm:px-8 md:flex-row md:items-end md:justify-between">
            <h2 className="display max-w-[14ch] text-[clamp(38px,5vw,64px)]">Change the moment. Watch the answer change.</h2>
            <Link href="/lab" className="rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.97]">
              Open the Decision Lab
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-8 text-[13px] text-muted sm:flex-row sm:justify-between sm:px-8">
          <p>PS-01 Commerce. Merchants, people and the week are synthetic demo data.</p>
          <p>
            API: <code className="font-mono">POST /api/solve</code>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] leading-snug text-muted">{label}</dt>
      <dd className={`mt-1 text-[26px] font-semibold tracking-tight ${accent ? "text-accent-text" : ""}`}>{value}</dd>
    </div>
  );
}

function Big({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className="bg-bg p-6">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className={`mt-2 text-[40px] font-semibold leading-none tracking-tight ${accent ? "text-accent-text" : ""}`}>{value}</dd>
      <dd className="mt-2 text-[13px] text-muted">{note}</dd>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className={`text-right text-[18px] font-semibold ${accent ? "text-accent-text" : ""}`}>{value}</dd>
    </div>
  );
}
