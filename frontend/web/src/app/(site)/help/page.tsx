"use client";

import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";

export default function HelpPage() {
  const q = useQuery({ queryKey: ["public-content", "help"], queryFn: () => endpoints.content(typeof window === "undefined" ? "en" : localStorage.getItem("ptf.locale") ?? "en") });
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-maroon">Help and support</h1>
      <p className="mt-3 text-sm text-muted">Gifting is voluntary. A square foot is a symbolic contribution toward a down payment, not a sale of property.</p>
      <p className="mt-4 text-sm">Phone: {q.data?.supportPhone ?? "Set by the admin in content settings"}</p>
      <p className="text-sm">Email: {q.data?.supportEmail ?? "Set by the admin in content settings"}</p>
      <p className="mt-6 whitespace-pre-line text-sm text-muted">{q.data?.disclaimer}</p>
    </div>
  );
}
