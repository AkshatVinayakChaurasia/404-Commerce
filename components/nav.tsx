"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { AccountMenu } from "./auth/account-menu";
import { useViewer } from "./auth/use-viewer";

const LINKS = [
  { href: "/lab", label: "Decision Lab" },
  { href: "/customer", label: "Customer" },
  { href: "/merchant", label: "Merchant" },
];

export function Nav({ theme }: { theme: "dark" | "light" }) {
  const path = usePathname();
  const { me } = useViewer();
  // Signed in with a role: show their own page under a personal name, not the other side's.
  const role = me?.user ? me.profile?.role : null;
  const links =
    role === "merchant"
      ? [LINKS[0], { href: "/merchant", label: "My shop" }]
      : role === "customer"
        ? [LINKS[0], { href: "/customer", label: "My offers" }]
        : LINKS;
  return (
    <header className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 sm:px-8">
      <Link href="/" aria-label="AscenDex home" className="mr-auto">
        <Logo />
      </Link>
      <nav aria-label="Main" className="order-3 -mx-2 flex w-[calc(100%+16px)] gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto">
        {links.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] transition-colors ${
                active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle pageDefault={theme} />
      <AccountMenu />
      <Link
        href="/lab"
        className="hidden rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.97] lg:inline-flex"
      >
        Open the lab
      </Link>
    </header>
  );
}
