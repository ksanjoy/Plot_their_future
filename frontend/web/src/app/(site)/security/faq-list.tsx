"use client";

import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "Where does my money go? Is it held in personal accounts?",
    a: "No funds ever enter personal accounts or startup wallets. Every rupee is routed directly into an RBI-regulated tripartite escrow account maintained with a scheduled commercial bank until formal developer settlement. Each settlement needs approval from the couple and from our compliance desk.",
  },
  {
    q: "Can I gift fractional square feet or sponsor an entire room?",
    a: "You can gift as little as 1 sq.ft. (₹4,500 at the standard rate). Guests, corporate colleagues and cousin circles frequently pool funds together to sponsor larger zones like the balcony or living room.",
  },
  {
    q: "What happens if the apartment goal isn't fully reached?",
    a: "100% completion is not required. Whatever square footage is funded (for example 35% or 420 SFT) is disbursed directly to the developer as an upfront down payment or applied as principal prepayment on the couple's home loan.",
  },
  {
    q: "Is this gift taxable for the newlyweds or the contributing guest under Indian law?",
    a: "No. Under Section 56(2)(x) of the Income Tax Act, genuine gifts presented on the occasion of marriage are exempt from income tax without any monetary upper limit. You receive a signed digital receipt for your records.",
  },
  {
    q: "Why are other weddings on the platform locked or greyed out when I log in?",
    a: "PlotTheirFuture enforces strict tenant isolation. Your account is linked only to the weddings that invited your mobile number. Every other celebration stays locked and anonymised to protect the families' privacy.",
  },
  {
    q: "Where will my personal blessing and gift confirmation be displayed during the wedding?",
    a: "Your blessing is tagged to your funded floor-plan tiles, saved in the couple's digital guest book and, if the couple enables it, shown on the venue LED wall. You also receive a WhatsApp confirmation with your receipt.",
  },
  {
    q: "Can I contribute anonymously without having my name shown publicly?",
    a: "Yes. Toggle \"Gift anonymously\" during checkout. Your contribution is credited to the couple as \"A Well-Wisher\" on the donor wall and stage screen, while your receipt still carries your name.",
  },
  {
    q: "How do I know my receipt is genuine?",
    a: "Every receipt carries a SHA-256 hash and an HMAC signature. Scan the QR code on the PDF or enter the receipt number on the verification page to confirm it with our servers.",
  },
  {
    q: "What if two guests pick the same square foot at the same time?",
    a: "Square feet are reserved for 10 minutes while you pay. Reservations are serialised, so a tile can never be sold twice. If your reservation expires, simply pick again.",
  },
];

export function FaqList() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const q = query.trim().toLowerCase();
  const items = FAQS.map((f, i) => ({ ...f, i })).filter((f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));

  return (
    <div className="mt-8">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={16} />
        <input
          className="input pl-9"
          placeholder="Search safety, tax or gifting questions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search FAQ"
        />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((f) => (
          <div key={f.i} className="card overflow-hidden">
            <button className="flex w-full items-center justify-between gap-4 p-4 text-left font-semibold" onClick={() => setOpen(open === f.i ? null : f.i)} aria-expanded={open === f.i}>
              {f.q}
              <ChevronDown size={18} className={`shrink-0 text-gold transition ${open === f.i ? "rotate-180" : ""}`} />
            </button>
            {open === f.i && <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{f.a}</p>}
          </div>
        ))}
        {!items.length && <p className="py-6 text-center text-sm text-muted">No answers match &ldquo;{query}&rdquo;.</p>}
      </div>
    </div>
  );
}
