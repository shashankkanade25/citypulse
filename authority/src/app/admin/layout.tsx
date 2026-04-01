'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      // Check if user is admin
      if (!data.user || data.user.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      
      setUser(data.user);
    } catch (error) {
      router.push('/sign-in');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-500 text-sm font-medium">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {children}
    </main>
  );
}
