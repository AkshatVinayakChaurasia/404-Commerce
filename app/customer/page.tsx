import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { RoleGate } from "@/components/auth/role-gate";
import { CustomerApp } from "@/components/customer/customer";
import { dataset } from "@/lib/official/adapter";
import { haversineM } from "@/lib/engine/util";
import { NEARBY_M } from "@/lib/live/feed";

export const metadata: Metadata = {
  title: "Customer app | AscenDex",
  description: "Any customer from the dataset, the offers they would get right now, and a code to claim one.",
};

export default function CustomerPage() {
  const customers = dataset.customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      locality: c.locality,
      language: c.language,
      nearby: dataset.merchants.filter((m) => haversineM({ lat: c.lat, lng: c.lng }, { lat: m.lat, lng: m.lng }) <= NEARBY_M).length,
    }))
    // People with shops around them first: they are the ones the app can serve.
    .sort((a, b) => Number(b.nearby > 0) - Number(a.nearby > 0) || a.name.localeCompare(b.name));
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav theme="light" />
      <main>
        <CustomerApp customers={customers} />
        <RoleGate role="customer" />
      </main>
    </div>
  );
}
