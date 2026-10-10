import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Customer } from "@/components/customer/customer";

export const metadata: Metadata = {
  title: "Customer view | AscenDex",
  description: "The offer as the person receives it: one notification, one card, every number decided by the engine.",
};

export default function CustomerPage() {
  return (
    <div className="theme-light min-h-dvh bg-bg text-text">
      <Nav />
      <main>
        <Customer />
      </main>
    </div>
  );
}
