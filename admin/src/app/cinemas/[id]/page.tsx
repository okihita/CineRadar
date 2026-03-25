import { CinemaDetailView } from '@/features/cinemas';

export default async function CinemaDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <CinemaDetailView theatreId={id} />;
}
