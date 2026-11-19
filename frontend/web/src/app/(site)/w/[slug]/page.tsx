import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { MicrositeView } from "./microsite-view";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API}/api/v1/public/weddings/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: "Wedding invitation", robots: { index: false } };
    const data = (await res.json()) as { brideName: string; groomName: string; line: string; coverPhotoUrl: string | null };
    const title = `${data.brideName} & ${data.groomName}`;
    return {
      title,
      description: data.line,
      openGraph: { title, description: data.line, images: data.coverPhotoUrl ? [{ url: data.coverPhotoUrl }] : undefined },
      robots: { index: false },
    };
  } catch {
    return { title: "Wedding invitation", robots: { index: false } };
  }
}

export default function MicrositePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MicrositeView />
    </Suspense>
  );
}
