import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Website SEO & Deployment Readiness Validator",
  description: "Audit your website for SEO and production readiness",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-200">{children}</body>
    </html>
  );
}
