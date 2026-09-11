import { redirect } from 'next/navigation';

export default function CinePointInsightsRedirect() {
  redirect('/competitors/cinepoint?tab=insights');
}

