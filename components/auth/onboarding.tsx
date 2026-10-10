"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Panel, Segmented, Toggle } from "@/components/ui";
import { FoodGlyph } from "@/components/food-glyph";
import { LANG_NAME } from "@/components/live/shared";
import { useViewer } from "./use-viewer";

type Shop = { id: string; name: string; category: string; locality: string };
type Role = "customer" | "merchant";

export function Onboarding({
  initialRole,
  shops,
  places,
  categories,
}: {
  initialRole: Role | null;
  shops: Shop[];
  places: { name: string; shops: number }[];
  categories: string[];
}) {
  const router = useRouter();
  const { me, ready, refresh } = useViewer();
  const [role, setRole] = useState<Role>(initialRole ?? "customer");
  const [name, setName] = useState("");
  const [locality, setLocality] = useState("");
  const [language, setLanguage] = useState("en");
  const [interests, setInterests] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [shopId, setShopId] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the saved profile once it loads.
  useEffect(() => {
    if (!me?.profile) return;
    const p = me.profile;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time copy of server data into an editable form */
    if (!initialRole && p.role) setRole(p.role);
    setName(p.display_name ?? me.user?.name ?? "");
    if (p.locality) setLocality(p.locality);
    setLanguage(p.language || "en");
    setInterests(p.interests ?? []);
    setConsent(Boolean(p.marketing_consent));
    if (p.merchant_id) setShopId(p.merchant_id);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me, initialRole]);

  const taken = useMemo(() => new Set(me?.taken_merchant_ids ?? []), [me]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shops.filter((s) => !q || `${s.name} ${s.category} ${s.locality}`.toLowerCase().includes(q));
  }, [shops, query]);

  if (!ready) return <p className="py-10 text-muted">Loading your account…</p>;
  if (!me?.login) return <p className="py-10 text-muted">Sign-in isn&apos;t configured on this deployment.</p>;
  if (!me.user)
    return (
      <div className="py-10">
        <p className="text-[16px]">Sign in first to set up your profile.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 font-semibold text-on-accent">
          Sign in
        </Link>
      </div>
    );

  async function save() {
    setSaving(true);
    setError(null);
    const body =
      role === "merchant"
        ? { role, merchant_id: shopId, display_name: name }
        : { role, display_name: name, locality, language, interests, marketing_consent: consent };
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your profile");
        return;
      }
      await refresh();
      router.push(role === "merchant" ? "/merchant" : "/customer");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = role === "merchant" ? Boolean(shopId) : Boolean(locality);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="title text-[clamp(28px,3.6vw,42px)]">{me.profile?.role ? "Your profile" : `Welcome, ${(name || "there").split(" ")[0]}`}</h1>
        <p className="mt-2 text-[16px] text-muted">Signed in with Google. Choose how you use AscenDex.</p>
      </div>

      {!me.saved && (
        <p className="rounded-[var(--radius-control)] bg-accent-tint px-4 py-3 text-[13.5px] text-accent-text">
          Accounts aren&apos;t being saved permanently on this server yet. You can set up your profile, but it may reset.
        </p>
      )}

      <Panel>
        <Segmented
          label="I am"
          value={role}
          options={[
            { value: "customer", label: "A customer" },
            { value: "merchant", label: "A shop owner" },
          ]}
          onChange={setRole}
        />
        <label className="block py-3">
          <span className="mb-2 block text-[14px] text-muted">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2.5 text-[15px]"
          />
        </label>
      </Panel>

      {role === "customer" ? (
        <Panel title="Where and how">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[14px] text-muted">Where you usually are</span>
              <select value={locality} onChange={(e) => setLocality(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2.5 text-[15px]">
                <option value="">Choose an area</option>
                {places.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.shops} shops)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[14px] text-muted">Language for offers</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2.5 text-[15px]">
                {Object.entries(LANG_NAME).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mt-5">
            <legend className="mb-2 text-[14px] text-muted">What you like (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = interests.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests(on ? interests.filter((x) => x !== c) : [...interests, c])}
                    className={`rounded-full border px-3 py-1.5 text-[13.5px] capitalize ${on ? "border-accent bg-accent-tint text-accent-text" : "border-line text-muted hover:text-text"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 border-t border-line">
            <Toggle
              label="Send me offers from shops near me"
              hint="Off by default. Without this, AscenDex never sends you anything."
              checked={consent}
              onChange={setConsent}
            />
          </div>
        </Panel>
      ) : (
        <Panel title="Your shop" aside={shopId ? shops.find((s) => s.id === shopId)?.name : "Choose one"}>
          <input
            type="search"
            aria-label="Search shops"
            placeholder="Search by name, type or area"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2.5 text-[15px]"
          />
          <ul className="-mx-2 mt-3 max-h-[46vh] overflow-y-auto">
            {shown.map((s) => {
              const isTaken = taken.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={isTaken}
                    onClick={() => setShopId(s.id)}
                    aria-pressed={shopId === s.id}
                    className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left disabled:opacity-45 ${shopId === s.id ? "bg-accent-tint" : "hover:bg-surface-2"}`}
                  >
                    <FoodGlyph category={s.category} size={24} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12.5px] capitalize text-muted">
                        {s.category}, {s.locality}
                      </span>
                    </span>
                    {isTaken && <span className="text-[12px] text-muted">Taken</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">
            One account per shop. Once you claim it, only you can change its offer rules or redeem its codes.
          </p>
        </Panel>
      )}

      {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className="rounded-full bg-accent px-6 py-3 text-[15.5px] font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving…" : role === "merchant" ? "Open my dashboard" : "Show my offers"}
        </button>
        {!canSave && <span className="text-[13.5px] text-muted">{role === "merchant" ? "Choose your shop first." : "Choose your area first."}</span>}
      </div>
    </div>
  );
}
