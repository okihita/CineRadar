/**
 * /competitors → redirects to /competitors/{today's date in Jakarta timezone}
 */
import { redirect } from 'next/navigation';

export default function CompetitorsRedirect() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  redirect(`/competitors/${today}`);
}
