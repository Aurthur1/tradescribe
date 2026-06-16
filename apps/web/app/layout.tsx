import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeScribe",
  description:
    "Read-only MT4/MT5 trade journaling, deterministic analytics, and weekly coaching for forex and prop-firm traders."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
