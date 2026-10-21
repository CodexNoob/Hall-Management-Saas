import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import { AppLanguageProvider } from "@/components/providers/app-language-provider";
import { ToastProvider } from "@/components/ui/toast";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={manrope.variable} lang="en" data-scroll-behavior="smooth">
      <body>
        {/*
          Outermost, above the toaster and every route: the dashboard layout
          used to mount this itself, which put its own loading and
          access-restricted copy - and every toast - outside the only thing
          that could translate them. It starts in English and re-syncs when the
          session reports the organization's language.
        */}
        <AppLanguageProvider>
          <AppServiceWorkerRegistration />
          <ToastProvider>{children}</ToastProvider>
        </AppLanguageProvider>
      </body>
    </html>
  );
}
