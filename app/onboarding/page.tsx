import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { Onboarding } from "@/components/auth/onboarding";
import { dataset } from "@/lib/official/adapter";
import { CATEGORIES, PLACES } from "@/lib/live/places";

export const metadata: Metadata = {
  title: "Your profile | AscenDex",
  description: "Choose how you use AscenDex: as a customer or as a shop owner.",
};

async function WithRole({ searchParams, ...rest }: { searchParams: PageProps<"/onboarding">["searchParams"] } & Omit<Parameters<typeof Onboarding>[0], "initialRole">) {
  const sp = await searchParams;
  const as = sp.as === "merchant" ? "merchant" : sp.as === "customer" ? "customer" : null;
  return <Onboarding initialRole={as} {...rest} />;
}

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const shops = dataset.merchants
    .map((m) => ({ id: m.id, name: m.name, category: m.category, locality: m.locality }))
    .sort((a, b) => a.locality.localeCompare(b.locality) || a.name.localeCompare(b.name));
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav theme="light" />
      <main className="mx-auto max-w-[860px] px-4 pb-24 pt-6 sm:px-8">
        <Suspense fallback={<p className="py-10 text-muted">Loading your account…</p>}>
          <WithRole searchParams={searchParams} shops={shops} places={PLACES.map((p) => ({ name: p.name, shops: p.shops }))} categories={CATEGORIES} />
        </Suspense>
      </main>
    </div>
  );
}
