"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { errorMessage, Field, PageLoader } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function WelcomeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { reload } = useAuth();
  const requested = params.get("next");
  const next = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [password, setPassword] = useState("");
  const save = useMutation({
    mutationFn: () => endpoints.completeProfile({ name, occupation, password }),
    onSuccess: async () => {
      await reload();
      router.replace(next);
    },
  });
  return (
    <form
      className="card mx-auto mt-10 w-full max-w-md space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">First sign-in</p>
      <h1 className="font-display text-2xl font-bold text-maroon">Tell us who you are</h1>
      <p className="text-sm text-muted">Name, occupation and a password. Next time you can sign in with the password or a one-time code.</p>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      <Field label="Occupation">
        <input className="input" value={occupation} onChange={(e) => setOccupation(e.target.value)} required maxLength={80} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
      </Field>
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WelcomeForm />
    </Suspense>
  );
}
