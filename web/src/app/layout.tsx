import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ParaPo — PUV Fare Wallet on Stellar",
  description:
    "Decentralized PUV fare payments. Scan to ride, pay the exact fare, get refunded automatically. Powered by Stellar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ParaPo" },
};

export const viewport: Viewport = {
  themeColor: "#0FB866",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          {children}
        </div>
        <ServiceWorker />
      </body>
    </html>
  );
}
