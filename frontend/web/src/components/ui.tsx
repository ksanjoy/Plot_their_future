"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

export function Spinner({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-10 text-sm text-muted ${className}`} role="status">
      <Loader2 className="animate-spin text-maroon" size={18} />
      {label}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
  return (
    <div className="card mx-auto my-10 max-w-md p-6 text-center">
      <p className="font-serif text-lg text-maroon">We couldn&apos;t load this</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className = "", tone = "gold" }: { value: number; className?: string; tone?: "gold" | "maroon" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-line/70 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-700 ${tone === "gold" ? "gold-gradient" : "maroon-gradient"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-ivory shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ivory/95 px-5 py-4 backdrop-blur">
          <h2 className="font-display text-lg font-bold tracking-wide text-maroon">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-line/60" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warn" | "danger" | "gold" }) {
  const tones = {
    neutral: "bg-line/60 text-ink",
    success: "bg-gold text-maroon",
    warn: "bg-gold text-maroon",
    danger: "bg-maroon text-ivory",
    gold: "bg-gold text-maroon",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center">
      <p className="font-serif text-lg text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
