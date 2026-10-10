import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { RoleGate } from "@/components/auth/role-gate";
import { MerchantDashboard } from "@/components/merchant/merchant";
import { dataset } from "@/lib/official/adapter";

export const metadata: Metadata = {
  title: "Merchant dashboard | AscenDex",
  description: "Live decisions for your shop, real claims at the counter, and the rules the engine follows.",
};

export default function MerchantPage() {
  const merchants = dataset.merchants
    .map((m) => ({ id: m.id, name: m.name, category: m.category, locality: m.locality }))
    .sort((a, b) => a.locality.localeCompare(b.locality) || a.name.localeCompare(b.name));
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav theme="light" />
      <main>
        <MerchantDashboard merchants={merchants} />
        <RoleGate role="merchant" />
      </main>
    </div>
  );
}
