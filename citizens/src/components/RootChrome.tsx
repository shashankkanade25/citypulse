'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import ChatBot from '@/components/ChatBot';

const HIDE_CHROME_PREFIXES = ['/sign-in', '/sign-up', '/login', '/signup'];

export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const hideChrome = HIDE_CHROME_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))

  if (hideChrome) return <>{children}</>;

  return (
    <>
      <Navbar />
      {children}
      <ChatBot />
    </>
  );
}
