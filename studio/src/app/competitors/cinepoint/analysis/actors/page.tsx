import { redirect } from 'next/navigation';

export default function ActorsRedirect() {
    redirect('/competitors/cinepoint/analysis?tab=actors');
}
