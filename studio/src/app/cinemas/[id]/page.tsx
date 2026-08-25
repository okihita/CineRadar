import { CinemaDetailView } from '@/features/cinemas/components/CinemaDetailView';

export default async function CinemaDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <CinemaDetailView theatreId={id} />;
}
