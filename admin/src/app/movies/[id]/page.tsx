import { MovieDatabaseDetail } from '@/features/movie-database';

export default async function MovieDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <MovieDatabaseDetail movieId={id} />;
}
