"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useViewer } from "./use-viewer";

/** Sign-in link, or the signed-in person's menu. Hidden when login isn't configured. */
export function AccountMenu() {
  const { me, ready } = useViewer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!ready || !me?.login) return <span className="w-[74px]" aria-hidden="true" />;
  if (!me.user) {
    return (
      <Link href="/login" className="rounded-full border border-line-strong px-4 py-2 text-[15px] font-medium transition-colors hover:bg-surface">
        Sign in
      </Link>
    );
  }

  const name = me.user.name ?? me.user.email ?? "Account";
  const role = me.profile?.role;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        className="flex h-9 items-center gap-2 rounded-full border border-line pl-1 pr-3 text-[14px] hover:bg-surface"
      >
        {me.user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.user.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-on-accent">{name[0]?.toUpperCase()}</span>
        )}
        <span className="max-w-[120px] truncate">{name.split(" ")[0]}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.45)]">
          <p className="px-3 py-2 text-[12.5px] text-muted">
            {role === "merchant" && me.shop ? `Running ${me.shop.name}` : role === "customer" ? `Customer in ${me.profile?.locality}` : "Finish setting up your account"}
          </p>
          {role === "merchant" && (
            <MenuLink href="/merchant" onClick={() => setOpen(false)}>
              My shop dashboard
            </MenuLink>
          )}
          {role === "customer" && (
            <MenuLink href="/customer" onClick={() => setOpen(false)}>
              My offers
            </MenuLink>
          )}
          <MenuLink href="/onboarding" onClick={() => setOpen(false)}>
            {role ? "Edit profile" : "Set up account"}
          </MenuLink>
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className="w-full rounded-[10px] px-3 py-2 text-left text-[14px] hover:bg-surface-2">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className="block rounded-[10px] px-3 py-2 text-[14px] hover:bg-surface-2">
      {children}
    </Link>
  );
}
