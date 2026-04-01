import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LoginPage from '../login/page';

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  return <LoginPage />;
}
