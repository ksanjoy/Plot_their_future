import type { Metadata, Viewport } from "next";
import { Cinzel, Outfit, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "700"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PlotTheirFuture • Gift a Square Foot", template: "%s • PlotTheirFuture" },
  description:
    "Skip the boxed gifts, gift a square foot! Private wedding microsites with RSVPs, WhatsApp invitations and an escrow-backed home registry.",
};

export const viewport: Viewport = { themeColor: "#8B1E2D" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cinzel.variable} ${playfair.variable} ${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
