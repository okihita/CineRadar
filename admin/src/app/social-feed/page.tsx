/**
 * /social-feed → redirects to /social-feed/{today's date in Jakarta timezone}
 */
import { redirect } from 'next/navigation';

export default function SocialFeedRedirect() {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    redirect(`/social-feed/${today}`);
}
