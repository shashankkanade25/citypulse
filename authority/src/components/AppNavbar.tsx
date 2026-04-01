"use client";

import { usePathname } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";
import Navbar from "@/components/Navbar";
import WorkerNavbar from "@/components/WorkerNavbar";

export default function AppNavbar() {
  const pathname = usePathname();

  if (pathname === "/sign-in" || pathname === "/sign-up") {
    return null;
  }

  // Worker pages have their own inline navbar
  if (pathname.startsWith("/worker")) {
    return null;
  }

  if (pathname.startsWith("/admin")) {
    return <AdminNavbar />;
  }

  if (pathname.startsWith("/worker")) {
    return <WorkerNavbar />;
  }

  return <Navbar />;
}
