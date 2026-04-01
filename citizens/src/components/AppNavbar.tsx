"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default function AppNavbar() {
  const pathname = usePathname();

  // Hide navbar on landing page, login, and signup pages
  if (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    return null;
  }

  return <Navbar />;
}
