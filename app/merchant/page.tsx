import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { MerchantDashboard } from "@/components/merchant/merchant";

export const metadata: Metadata = {
  title: "Merchant dashboard | AscenDex",
  description: "Set the rules, run a simulated week, and see which buyers came because of an offer.",
};

export default function MerchantPage() {
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav />
      <main>
        <MerchantDashboard />
      </main>
    </div>
  );
}
