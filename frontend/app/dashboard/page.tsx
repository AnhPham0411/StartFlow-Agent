import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/nba/calllist');
}
