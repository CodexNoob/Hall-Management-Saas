import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hall Management",
  description: "Hall, event, kitchen, payment, and calendar management platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
