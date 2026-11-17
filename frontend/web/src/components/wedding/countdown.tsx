"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export function Countdown({ to, light = false }: { to: string; light?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <div className="h-16" />;
  const diff = new Date(to).getTime() - now;
  if (diff <= 0) {
    return <p className={`font-serif text-lg italic ${light ? "text-gold-light" : "text-maroon"}`}>Happily married! Thank you for celebrating with us.</p>;
  }
  const p = parts(diff);
  return (
    <div className="flex gap-2">
      {(
        [
          ["Days", p.days],
          ["Hours", p.hours],
          ["Mins", p.minutes],
          ["Secs", p.seconds],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className={`w-16 rounded-xl py-2 text-center ${light ? "bg-white/10 text-white" : "bg-white text-ink shadow-sm"}`}>
          <p className="font-display text-xl font-bold tabular-nums">{String(value).padStart(2, "0")}</p>
          <p className={`text-[10px] font-semibold tracking-widest uppercase ${light ? "text-gold-light" : "text-muted"}`}>{label}</p>
        </div>
      ))}
    </div>
  );
}
