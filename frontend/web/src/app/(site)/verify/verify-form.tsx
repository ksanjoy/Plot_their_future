"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const normalized = value.trim().toUpperCase();
  const valid = /^PTF-\d{4}-[A-Z0-9]{8}$/.test(normalized);
  return (
    <form
      className="card mt-6 flex gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/verify/${normalized}`);
      }}
    >
      <input className="input font-mono" placeholder="PTF-2026-XXXXXXXX" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Receipt number" />
      <button className="btn-primary" disabled={!valid}>
        Verify
      </button>
    </form>
  );
}
