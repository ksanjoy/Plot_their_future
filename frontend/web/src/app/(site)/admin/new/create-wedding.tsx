"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_ROOMS, RoomsEditor } from "@/components/admin/rooms-editor";
import { toWeddingBody, useWeddingForm, WeddingFields } from "@/components/admin/wedding-form";
import { RequireAuth } from "@/components/require-auth";
import { useToast } from "@/components/toast";
import { errorMessage, Field } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RoomInput } from "@/lib/types";

export function CreateWedding() {
  return (
    <RequireAuth>
      <CreateForm />
    </RequireAuth>
  );
}

function CreateForm() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { reload } = useAuth();
  const [values, setValues] = useWeddingForm();
  const [rooms, setRooms] = useState<RoomInput[]>(DEFAULT_ROOMS);
  const [slug, setSlug] = useState("");

  const create = useMutation({
    mutationFn: () => endpoints.createWedding({ ...toWeddingBody(values), rooms, slug: slug.trim() || undefined }),
    onSuccess: async (w) => {
      toast("Your wedding microsite is ready!");
      await reload();
      void qc.invalidateQueries({ queryKey: ["my-weddings"] });
      router.push(`/admin/${w.slug}?tab=guests`);
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">New celebration</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-maroon">Create your wedding microsite</h1>
      <p className="mt-2 text-sm text-muted">You&apos;ll be the host. You can change everything later, add co-hosts and invite guests.</p>
      <form
        className="card mt-8 space-y-8 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <WeddingFields values={values} onChange={setValues} />
        <Field label="Web address (optional)" hint="Lowercase letters, digits and hyphens. Leave blank to generate from your names.">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted">/w/</span>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} />
          </div>
        </Field>
        <fieldset>
          <legend className="mb-2 font-serif text-lg font-bold text-maroon">Floor plan</legend>
          <RoomsEditor rooms={rooms} onChange={setRooms} />
        </fieldset>
        {create.isError && <p className="text-sm text-maroon">{errorMessage(create.error)}</p>}
        <button className="btn-primary w-full" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create microsite"}
        </button>
      </form>
    </div>
  );
}
