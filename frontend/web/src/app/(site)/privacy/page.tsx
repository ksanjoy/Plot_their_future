"use client";

import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";

export default function PrivacyPage() {
  const q = useQuery({ queryKey: ["public-content", "privacy"], queryFn: () => endpoints.content(localStorage.getItem("ptf.locale") ?? "en") });
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-maroon">Privacy</h1>
      <p className="mt-4 whitespace-pre-line text-sm text-muted">{q.data?.privacy}</p>
    </article>
  );
}