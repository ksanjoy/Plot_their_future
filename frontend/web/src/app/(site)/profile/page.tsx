"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, Field } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function ProfileForm() {
  const { user, reload, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [occupation, setOccupation] = useState(user?.occupation ?? "");
  const [locale, setLocale] = useState(user?.locale ?? "en");
  const [optOut, setOptOut] = useState(Boolean(user?.messageOptOut));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const save = useMutation({
    mutationFn: () => endpoints.updateMe({ name, occupation, locale, messageOptOut: optOut }),
    onSuccess: async () => {
      localStorage.setItem("ptf.locale", locale);
      await reload();
    },
  });
  const complaint = useMutation({ mutationFn: () => endpoints.fileComplaint({ subject, message }) });
  const erase = useMutation({
    mutationFn: () => endpoints.eraseMe(),
    onSuccess: () => void signOut(),
  });
  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-maroon">Profile</h1>
      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Occupation"><input className="input" value={occupation} onChange={(e) => setOccupation(e.target.value)} /></Field>
        <Field label="Language">
          <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="te">తెలుగు</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} />
          Opt out of reminder and gift follow-up messages
        </label>
        {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
        <button className="btn-primary">Save</button>
      </form>
      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); complaint.mutate(); }}>
        <h2 className="font-serif text-lg font-bold">Help and complaints</h2>
        <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
        <Field label="Message"><textarea className="input min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} required /></Field>
        {complaint.isSuccess && <p className="text-sm text-emerald-800">Sent. The admin team can see it on the platform desk.</p>}
        <button className="btn-ghost">Send</button>
      </form>
      <button className="text-sm text-maroon underline" onClick={() => { if (confirm("Erase your name, occupation and password?")) erase.mutate(); }}>
        Delete my profile data
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
