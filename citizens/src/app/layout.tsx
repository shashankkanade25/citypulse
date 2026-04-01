import type { Metadata } from "next";
import "./globals.css";
import AppNavbar from "@/components/AppNavbar";
import ChatBot from "@/components/ChatBot";

export const metadata: Metadata = {
  title: "CityPulse - Your City, Your Voice",
  description: "Real-Time Urban Infrastructure Incident & Maintenance Platform. Report issues, track progress, and build a more transparent city.",
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
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ fontFamily: "'Open Sans', sans-serif" }}>
        <AppNavbar />
        {children}
        <ChatBot />
      </body>
    </html>
  );
}
