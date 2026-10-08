import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Website Validator",
  description: "SEO audits and content checks against approved Word documents",
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
