import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "Event Core",
  description:
    "Hall, event, kitchen, payment, and calendar management platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={manrope.variable} lang="en" data-scroll-behavior="smooth">
      <body>
        <AppServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
