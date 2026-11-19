"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";

const SEEN = "ptf.introSeen";

export function IntroGate() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const content = useQuery({ queryKey: ["public-content", "intro"], queryFn: () => endpoints.content(localStorage.getItem("ptf.locale") ?? "en"), enabled: open });

  useEffect(() => {
    if (!localStorage.getItem(SEEN)) setOpen(true);
  }, []);

  if (!open) return null;
  const screens = content.data?.intro ?? [];
  const current = screens[step];
  const last = step >= Math.max(screens.length - 1, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon/80 p-4">
      <div className="card w-full max-w-lg p-6">
        <p className="text-xs font-semibold tracking-[0.25em] text-maroon uppercase">PlotTheirFuture</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-maroon">{current?.title ?? "The wedding gift that becomes their forever."}</h2>
        <p className="mt-3 text-sm text-muted">{current?.body ?? "Loved ones contribute toward a couple's first home."}</p>
        <div className="mt-6 flex items-center justify-between">
          <button className="text-sm text-muted" onClick={() => { localStorage.setItem(SEEN, "1"); setOpen(false); }}>
            Skip
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!last && screens.length) setStep((n) => n + 1);
              else {
                localStorage.setItem(SEEN, "1");
                setOpen(false);
              }
            }}
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
