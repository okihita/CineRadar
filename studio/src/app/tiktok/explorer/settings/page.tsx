import { redirect } from 'next/navigation';

export default function SettingsRedirect() {
    redirect('/tiktok/ops?tab=sources');
}
