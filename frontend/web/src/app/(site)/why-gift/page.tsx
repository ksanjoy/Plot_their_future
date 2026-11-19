import type { Metadata } from "next";
import { Building2, IndianRupee, Landmark, MonitorPlay, Ruler } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Why Gift a Square Foot" };

const STEPS = [
  { icon: Ruler, title: "Explore the floor plan", body: "Review the 1,200 SFT 2 BHK architectural grid with Living, Master and Balcony zones." },
  { icon: IndianRupee, title: "Choose your footage", body: "Select 1 SFT (₹4.5k), 5 SFT (₹22.5k), 10 SFT (₹45k) or enter a custom amount of square feet." },
  { icon: Landmark, title: "RBI tripartite escrow pay", body: "Complete an instant UPI or card payment, ring-fenced in escrow for builder settlement." },
  { icon: MonitorPlay, title: "Live on the LED wall", body: "Your blessing and tile are beamed onto the banquet hall LED screens in real time!" },
];

export default function WhyGiftPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <p className="text-center text-xs font-semibold tracking-[0.25em] text-maroon uppercase">The smarter choice for modern weddings</p>
      <h1 className="mt-3 text-center font-display text-3xl font-bold text-maroon md:text-4xl">Why gift a square foot?</h1>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="card border-maroon p-6">
          <p className="font-serif text-xl font-bold text-maroon">Traditional boxed gifts</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>❌ 3-4 duplicate mixer grinders</li>
            <li>❌ Unused crockery & irons</li>
            <li>❌ Misplaced cash envelopes</li>
            <li>❌ Depreciates to ₹0 over time</li>
          </ul>
        </div>
        <div className="card border-gold p-6">
          <p className="font-serif text-xl font-bold text-maroon">A square foot of their home</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>✅ Goes straight into the couple&apos;s first home</li>
            <li>✅ Held in RBI tripartite escrow, settled to a RERA builder</li>
            <li>✅ Tax-exempt marriage gift under Sec 56(2)(x)</li>
            <li>✅ Appreciates year after year</li>
          </ul>
        </div>
      </div>

      <h2 className="mt-14 text-center font-display text-2xl font-bold text-maroon">Four simple steps</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card p-5 text-center">
            <span className="gold-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-full text-ink">
              <s.icon size={20} />
            </span>
            <p className="mt-3 font-display text-xs font-bold text-maroon">STEP {i + 1}</p>
            <p className="mt-1 font-serif text-lg font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 grid items-center gap-8 md:grid-cols-[1fr_1.2fr]">
        <Image src="/images/floor_plan.jpg" alt="2 BHK floor plan" width={800} height={800} className="rounded-3xl border border-line shadow-lg" />
        <div className="card p-6">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-maroon">
            <Building2 size={16} /> A message from PlotTheirFuture
          </p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">Official registry notice & voluntary gifting disclaimer</p>
          <p className="mt-4 text-sm leading-relaxed">
            PlotTheirFuture is pleased to host this celebration registry on behalf of the couple and their families. We believe that an invited
            guest&apos;s presence is cherished above all material tokens. Gifting is purely optional; every guest is welcomed with open arms. For those
            who wish to bless the couple, you can sponsor a square foot of their home rather than boxed items.
          </p>
          <div className="mt-4 rounded-xl bg-ivory p-4 text-xs leading-relaxed text-muted">
            <p className="font-semibold text-ink">PLATFORM POLICY & GIFTING DISCLOSURE</p>
            <p className="mt-1">
              • Listed by PlotTheirFuture: created to prevent redundant electronics and misplaced cash envelopes, turning goodwill into lasting home equity.
            </p>
            <p className="mt-1">• Absolute free will: 100% tax-exempt under Section 56(2)(x) with direct escrow settlement to the RERA developer account.</p>
          </div>
          <p className="mt-4 font-serif text-sm text-maroon italic">&ldquo;Empowering loved ones to lay the foundation for a lifetime of memories.&rdquo;</p>
          <Link href="/security" className="btn-ghost mt-5">
            Read the escrow & tax FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
