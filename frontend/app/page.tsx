import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/nba/calllist');
}
