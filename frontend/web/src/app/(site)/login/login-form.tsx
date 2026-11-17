"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, MessageCircle, Smartphone } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { errorMessage, Field } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coupleName } from "@/lib/format";
import type { OtpRequest } from "@/lib/types";

const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : null);

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn, user, ready } = useAuth();
  const slug = params.get("slug") ?? undefined;
  const refToken = params.get("ref_token");
  const next = safeNext(params.get("next"));

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [request, setRequest] = useState<OtpRequest | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const preview = useQuery({
    queryKey: ["invitation-preview", refToken],
    queryFn: () => endpoints.invitationPreview(refToken!),
    enabled: Boolean(refToken),
  });

  useEffect(() => {
    if (ready && user && !request) router.replace(next ?? "/");
  }, [ready, user, request, next, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = useMutation({
    mutationFn: () => endpoints.requestOtp(phone, slug ?? preview.data?.wedding.slug),
    onSuccess: (res) => {
      setRequest(res);
      setCooldown(res.resendAfterSec);
      setOtp("");
    },
  });

  const verify = useMutation({
    mutationFn: () => endpoints.verifyOtp(request!.phone, otp, name),
    onSuccess: (session) => {
      signIn(session);
      const target = slug ?? preview.data?.wedding.slug;
      if (next) router.replace(next);
      else if (target) router.replace(`/w/${target}`);
      else if (session.weddings.length === 1) router.replace(`/w/${session.weddings[0].slug}`);
      else router.replace("/");
    },
  });

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 md:grid-cols-2">
      <div className="hidden md:block">
        <Image src="/images/couple_portrait.jpg" alt="" width={700} height={900} className="rounded-[2rem] border-4 border-gold/50 object-cover shadow-2xl" />
      </div>
      <div className="card p-6 md:p-8">
        <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">Private celebration</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-maroon">
          {preview.data ? `Namaste, ${preview.data.guestName}` : "Guest login"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {preview.data
            ? `You're invited to celebrate ${coupleName(preview.data.wedding)}. Sign in with ${preview.data.maskedPhone} to open your invitation.`
            : "Enter the mobile number your WhatsApp invitation was sent to. We'll send you a 6-digit code."}
        </p>

        {!request ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
          >
            <Field label="Mobile number">
              <div className="relative">
                <Smartphone className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="input pl-9"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98480 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </Field>
            {send.isError && <p className="text-sm text-maroon">{errorMessage(send.error)}</p>}
            <button className="btn-primary w-full" disabled={send.isPending || phone.replace(/\D/g, "").length < 10}>
              <MessageCircle size={16} /> {send.isPending ? "Sending…" : "Send code on WhatsApp"}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate();
            }}
          >
            <p className="rounded-xl bg-ivory p-3 text-sm">
              Code sent via <b>{request.channel === "whatsapp" ? "WhatsApp" : "SMS"}</b> to <b>{request.maskedPhone}</b>.{" "}
              <button type="button" className="font-semibold text-maroon underline" onClick={() => setRequest(null)}>
                Change
              </button>
            </p>
            {request.devOtp && (
              <p className="rounded-xl border border-dashed border-gold bg-gold/10 p-3 text-xs">
                Development mode: your code is <b className="font-mono text-sm tracking-widest">{request.devOtp}</b>
              </p>
            )}
            <Field label="6-digit code">
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="input pl-9 font-mono tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                />
              </div>
            </Field>
            <Field label="Your name (optional)" hint="Shown on your gift receipt and blessings.">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </Field>
            {verify.isError && <p className="text-sm text-maroon">{errorMessage(verify.error)}</p>}
            <button className="btn-primary w-full" disabled={verify.isPending || otp.length !== 6}>
              {verify.isPending ? "Verifying…" : "Verify & continue"}
            </button>
            <button type="button" className="w-full text-center text-sm text-muted disabled:opacity-50" disabled={cooldown > 0 || send.isPending} onClick={() => send.mutate()}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
