import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { GoogleButton } from "@/components/auth/google-button";
import { authConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in | AscenDex",
  description: "Sign in as a customer to get offers near you, or as a shop owner to run your dashboard.",
};

// Reading the query is request-time data, so it streams inside Suspense while the
// rest of the page stays static.
async function SigninError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.error !== "signin") return null;
  return (
    <p className="mt-6 rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">
      Sign-in didn&apos;t finish. Try again; if it keeps failing, check that this site&apos;s address is in the Supabase
      redirect URLs.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav theme="light" />
      <main className="mx-auto max-w-[980px] px-4 pb-24 pt-8 sm:px-8">
        <h1 className="title text-[clamp(30px,4vw,46px)]">Sign in to AscenDex</h1>
        <p className="mt-3 max-w-[60ch] text-[16px] text-muted">
          One account, two ways to use it. You can switch later from your profile. Just looking around? The{" "}
          <Link href="/lab" className="underline underline-offset-2">
            Decision Lab
          </Link>{" "}
          and the demo views work without signing in.
        </p>
        <Suspense fallback={null}>
          <SigninError searchParams={searchParams} />
        </Suspense>
        {!authConfigured() ? (
          <p className="mt-8 rounded-[var(--radius-panel)] border border-line bg-surface p-6 text-[15px] text-muted">
            Sign-in isn&apos;t configured on this deployment yet. Add NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the environment.
          </p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <section className="flex flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
              <h2 className="title text-[22px]">I want offers near me</h2>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-muted">
                <li>Offers only when they&apos;re worth it, in your language</li>
                <li>Claim with a code, pay at the counter</li>
                <li>You choose if you get offers at all</li>
              </ul>
              <div className="mt-6">
                <GoogleButton next="/onboarding?as=customer" label="Continue with Google" />
              </div>
            </section>
            <section className="flex flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
              <h2 className="title text-[22px]">I run a shop</h2>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-muted">
                <li>See every decision for your shop, and why</li>
                <li>Set your maximum discount, margin and hours</li>
                <li>Redeem codes at the counter, live</li>
              </ul>
              <div className="mt-6">
                <GoogleButton next="/onboarding?as=merchant" label="Continue with Google" />
              </div>
            </section>
          </div>
        )}
        <p className="mt-8 max-w-[70ch] text-[13px] text-muted">
          We store your name, your chosen area and language, and the offers you claim. No exact location, no payment
          details. You can turn offers off at any time.
        </p>
      </main>
    </div>
  );
}
