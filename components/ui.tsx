"use client";

import type { ReactNode } from "react";

export function Panel({ title, aside, children, className = "" }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-panel)] border border-line bg-surface p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="title text-[18px]">{title}</h2>}
          {aside && <div className="text-[13px] text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-[14px]">
        <span className="text-muted">{label}</span>
        {value !== undefined && <span className="font-semibold">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <Field label={label} value={format ? format(value) : value}>
      <input
        type="range"
        aria-label={label}
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-[var(--radius-control)] bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-w-0 flex-1 whitespace-nowrap rounded-[9px] px-1 py-1.5 text-[13px] transition-colors ${
              value === o.value ? "bg-bg font-semibold text-text shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="text-[14px] text-muted">{label}</p>
        {hint && <p className="text-[12px] text-muted/80">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative block h-[26px] w-[46px] shrink-0 rounded-full p-0 transition-colors ${checked ? "bg-accent" : "bg-surface-2 ring-1 ring-line-strong"}`}
      >
        <span
          className={`absolute left-0 top-[3px] h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[23px] bg-on-accent" : "translate-x-[3px] bg-muted"
          }`}
        />
      </button>
    </div>
  );
}

export function Chip({ tone, children }: { tone: "ok" | "bad" | "accent" | "muted"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-ok-tint text-ok"
      : tone === "bad"
        ? "bg-bad-tint text-bad"
        : tone === "accent"
          ? "bg-accent-tint text-accent-text"
          : "bg-surface-2 text-muted";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${cls}`}>{children}</span>;
}
