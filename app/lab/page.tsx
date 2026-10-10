import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Lab } from "@/components/lab/lab";

export const metadata: Metadata = {
  title: "Decision Lab | AscenDex",
  description: "Change the moment and watch the offer engine decide, step by step.",
};

export default function LabPage() {
  return (
    <div className="theme-dark min-h-dvh bg-bg text-text">
      <Nav />
      <main>
        <Lab />
      </main>
    </div>
  );
}
