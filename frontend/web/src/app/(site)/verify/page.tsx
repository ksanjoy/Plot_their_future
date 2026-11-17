import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify a gift receipt" };

export default function VerifyIndexPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-14">
      <h1 className="text-center font-display text-2xl font-bold text-maroon">Verify a gift receipt</h1>
      <p className="mt-2 text-center text-sm text-muted">Enter the receipt number printed on the PDF (for example PTF-2026-ABCD2345) or scan its QR code.</p>
      <VerifyForm />
    </div>
  );
}
