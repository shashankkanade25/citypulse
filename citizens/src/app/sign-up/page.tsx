import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SignupPage from '../signup/page';

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  return <SignupPage />;
}
