import type { Metadata } from "next";
import { Building2, Landmark, Puzzle, ReceiptIndianRupee } from "lucide-react";
import { FaqList } from "./faq-list";

export const metadata: Metadata = { title: "Security, Escrow & FAQ" };

const PILLARS = [
  { icon: Landmark, title: "100% RBI escrow protected" },
  { icon: Building2, title: "RERA builder direct transfer" },
  { icon: ReceiptIndianRupee, title: "Tax-exempt marriage gift" },
  { icon: Puzzle, title: "Flexible fractional gifting" },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <p className="text-center text-xs font-semibold tracking-[0.25em] text-gold uppercase">RBI escrow protection • RERA builder settlement</p>
      <h1 className="mt-3 text-center font-display text-3xl font-bold text-maroon">Security & frequently asked questions</h1>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PILLARS.map((p) => (
          <div key={p.title} className="card flex flex-col items-center gap-2 p-4 text-center">
            <p.icon className="text-gold" />
            <p className="text-sm font-semibold">{p.title}</p>
          </div>
        ))}
      </div>

      <div className="card mt-8 p-6">
        <p className="font-display text-sm font-bold text-maroon">WHAT HAPPENS TO YOUR MONEY?</p>
        <ol className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <li><span className="font-semibold">1. You pay</span><br />UPI or card through Razorpay&apos;s PCI-DSS checkout.</li>
          <li><span className="font-semibold">2. Escrow</span><br />Funds land in the couple&apos;s RBI tripartite escrow account.</li>
          <li><span className="font-semibold">3. Dual approval</span><br />The couple and our compliance desk both sign every settlement.</li>
          <li><span className="font-semibold">4. Home</span><br />Disbursed to the RERA builder or as home-loan principal.</li>
        </ol>
      </div>

      <FaqList />
    </div>
  );
}
