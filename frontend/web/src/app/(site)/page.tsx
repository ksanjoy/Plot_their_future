import { Gift, Home as HomeIcon, Lock, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SignedInHome } from "@/components/signed-in-home";
import { CelebrationFeed } from "./celebration-feed";

const STEPS = [
  { icon: MessageCircle, title: "WhatsApp invitation", body: "Every guest gets a private link to the couple's microsite with only the ceremonies they're invited to." },
  { icon: HomeIcon, title: "Pick your square feet", body: "Choose the living room, master bedroom or balcony on the live 2 BHK floor plan." },
  { icon: ShieldCheck, title: "Pay into escrow", body: "UPI or card via Razorpay, straight into an RBI tripartite escrow account for the RERA builder." },
  { icon: Sparkles, title: "See it on the big screen", body: "Your tile lights up and your blessing appears on the venue LED wall in real time." },
];

export default function HomePage() {
  return (
    <>
      <section className="maroon-gradient relative overflow-hidden text-white">
        <Image src="/images/hero_banner.jpg" alt="" fill priority className="object-cover opacity-25 mix-blend-luminosity" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-light">
              <Gift size={14} /> The modern wedding registry
            </p>
            <h1 className="mt-5 font-display text-4xl leading-tight font-bold md:text-5xl">
              Skip the boxed gifts,
              <br />
              <span className="text-gold-gradient">Gift a Square Foot!</span>
            </h1>
            <p className="mt-5 max-w-xl font-serif text-lg text-white/85 italic">
              Build their first home, one square foot at a time. Private microsites, WhatsApp RSVPs and an escrow-protected home registry for Indian weddings.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-gold">
                Open my invitation
              </Link>
              <Link href="/admin/new" className="btn border border-white/40 text-white hover:bg-white/10">
                Create a wedding microsite
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/75">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-gold-light" /> RBI tripartite escrow</span>
              <span className="flex items-center gap-1.5"><Lock size={14} className="text-gold-light" /> Invite-only privacy</span>
              <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-gold-light" /> Sec 56(2)(x) tax-exempt</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 rounded-[2rem] bg-gold/30 blur-2xl" />
            <Image
              src="/images/apartment_poster.jpg"
              alt="2 BHK dream apartment poster"
              width={600}
              height={800}
              className="relative rounded-[1.75rem] border-4 border-gold/60 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <SignedInHome />

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-maroon">Celebrations on PlotTheirFuture</h2>
            <p className="mt-1 text-sm text-muted">Every wedding is private. Sign in with the mobile number your invitation was sent to and yours unlocks.</p>
          </div>
        </div>
        <CelebrationFeed />
      </section>

      <section className="bg-white/70 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-2xl font-bold text-maroon">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="gold-gradient flex h-10 w-10 items-center justify-center rounded-full text-ink">
                    <s.icon size={18} />
                  </span>
                  <span className="font-display text-sm font-bold text-gold">STEP {i + 1}</span>
                </div>
                <p className="mt-3 font-serif text-lg font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/why-gift" className="btn-primary">
              Why gift a square foot?
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
