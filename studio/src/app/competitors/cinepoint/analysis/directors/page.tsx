import { redirect } from 'next/navigation';

export default function DirectorsRedirect() {
    redirect('/competitors/cinepoint/analysis?tab=directors');
}
