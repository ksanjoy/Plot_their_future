"use client";

import { LayoutDashboard, LogIn, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Celebrations" },
  { href: "/why-gift", label: "Why Gift Sq.Ft." },
  { href: "/security", label: "Security & FAQ" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="gold-gradient flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-bold text-ink shadow-sm">PTF</span>
      <span className={`font-display text-base font-bold tracking-wider ${light ? "text-white" : "text-maroon"}`}>
        PlotTheirFuture
      </span>
    </Link>
  );
}

export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Logo />
      </div>
    </header>
  );
}

export function SiteHeader() {
  const { ready, user, weddings, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const managesAny = weddings.some((w) => w.role !== "GUEST") || user?.isPlatformAdmin;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                pathname === n.href ? "bg-maroon text-white" : "text-ink hover:bg-line/60"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {ready && user ? (
            <>
              {managesAny && (
                <Link href="/admin" className="btn-ghost !py-2">
                  <LayoutDashboard size={16} /> Console
                </Link>
              )}
              {user.isPlatformAdmin && (
                <Link href="/admin/platform" className="btn-ghost !py-2">
                  <ShieldCheck size={16} /> Platform
                </Link>
              )}
              <Link href="/profile" className="btn-ghost !py-2">
                Profile
              </Link>
              <button
                className="btn-ghost !py-2"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary !py-2">
              <LogIn size={16} /> Guest login
            </Link>
          )}
        </div>
        <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-ivory px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-line/60">
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-3">
            {user ? (
              <>
                {managesAny && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="btn-ghost">
                    Console
                  </Link>
                )}
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    router.push("/");
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="btn-primary">
                Guest login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-white/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs">Skip the boxed gifts, gift a square foot. Every rupee is held in an RBI tripartite escrow until settlement with the RERA-registered builder.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Guests</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/why-gift" className="hover:text-maroon">Why gift a square foot</Link></li>
            <li><Link href="/security" className="hover:text-maroon">Escrow, tax & privacy FAQ</Link></li>
            <li><Link href="/verify" className="hover:text-maroon">Verify a gift receipt</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Couples & families</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/admin/new" className="hover:text-maroon">Create your wedding microsite</Link></li>
            <li><Link href="/admin" className="hover:text-maroon">Host console</Link></li>
            <li><Link href="/register" className="hover:text-maroon">Register a marriage</Link></li>
            <li><Link href="/terms" className="hover:text-maroon">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-maroon">Privacy</Link></li>
            <li><Link href="/help" className="hover:text-maroon">Help</Link></li>
          </ul>
          <p className="mt-4 text-xs">Marriage gifts are exempt under Sec 56(2)(x) of the Income Tax Act.</p>
        </div>
      </div>
    </footer>
  );
}
