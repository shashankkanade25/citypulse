import type { Metadata } from "next";
import "./globals.css";
import AppNavbar from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "Authority Head - CityPulse",
  description: "Department Control Panel for Authority Heads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&family=Open+Sans:wght@300..800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Open Sans', sans-serif" }}>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
