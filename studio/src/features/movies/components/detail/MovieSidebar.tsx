'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyViewer } from './PropertyViewer';

interface MovieSidebarProps {
    movie: Record<string, unknown>;
}

// Field mapping for human-readable labels
const FIELD_LABELS: Record<string, string> = {
    movie_id: 'Movie ID',
    title: 'Title',
    original_title: 'Original Title',
    synopsis: 'Synopsis',
    duration: 'Duration',
    release_date: 'Release Date',
    age_category: 'Age Rating',
    genres: 'Genres',
    directors: 'Directors',
    director: 'Director',
    cast: 'Cast',
    actor: 'Actor',
    producers: 'Producers',
    producer: 'Producer',
    writers: 'Writers',
    production_companies: 'Production Companies',
    production_company: 'Production Company',
    distributors: 'Distributors',
    countries: 'Countries',
    country: 'Country',
    languages: 'Languages',
    rating: 'Rating',
    rating_score: 'Rating Score',
    vote_count: 'Vote Count',
    popularity: 'Popularity',
    budget: 'Budget',
    revenue: 'Revenue',
    poster: 'Poster URL',
    backdrop: 'Backdrop URL',
    trailer: 'Trailer',
    trailer_path: 'Trailer Source URL',
    website: 'Official Website',
    imdb_id: 'IMDb ID',
    tmdb_id: 'TMDb ID',
    is_presale: 'Presale',
    presale_flag: 'Presale Flag',
    uploaded_at: 'Uploaded At',
    last_updated: 'Last Updated',
    created_at: 'Created At',
    updated_at: 'Updated At',
};

const SECTIONS = {
    overview: ['rating', 'rating_score', 'vote_count', 'popularity'],
    technical: ['original_title', 'directors', 'director', 'producers', 'producer', 'writers'],
    distribution: ['production_companies', 'production_company', 'distributors', 'countries', 'country', 'languages'],
    metadata: ['movie_id', 'imdb_id', 'tmdb_id', 'uploaded_at', 'last_updated', 'created_at', 'updated_at'],
};

const EXCLUDE_FIELDS = [
    'title', 'name', 'poster', 'poster_path', 'id', 'genres', 'age_category', 
    'is_presale', 'presale_flag', 'casts', 'cast', 'actor', 'release_date', 
    'duration', 'synopsis', 'scraped_at', 'status', 'videos', 'images', 
    'information', 'trailer_thumbnail_path'
];

export function MovieSidebar({ movie }: MovieSidebarProps) {
    const getFieldsForSection = (fieldList: string[]) => {
        return Object.entries(movie)
            .filter(([key]) => fieldList.includes(key) && movie[key] !== '' && movie[key] !== null)
            .map(([key, value]) => ({ key, value, label: FIELD_LABELS[key] || key }));
    };

    const otherFields = Object.entries(movie)
        .filter(([key]) =>
            !SECTIONS.overview.includes(key) &&
            !SECTIONS.technical.includes(key) &&
            !SECTIONS.distribution.includes(key) &&
            !SECTIONS.metadata.includes(key) &&
            !EXCLUDE_FIELDS.includes(key) &&
            movie[key] !== '' &&
            movie[key] !== null
        )
        .map(([key, value]) => ({ key, value, label: FIELD_LABELS[key] || key }));

    const sections = [
        { title: 'Overview', fields: getFieldsForSection(SECTIONS.overview) },
        { title: 'Technical Details', fields: getFieldsForSection(SECTIONS.technical) },
        { title: 'Distribution', fields: getFieldsForSection(SECTIONS.distribution) },
        { title: 'Metadata System', fields: getFieldsForSection(SECTIONS.metadata) },
        { title: 'Additional Payload Data', fields: otherFields, isSecondary: true },
    ];

    return (
        <div className="space-y-6">
            {sections.map((section) => {
                if (section.fields.length === 0) return null;

                return (
                    <Card key={section.title} className={`rounded border-border shadow-none ${section.isSecondary ? 'opacity-80' : ''}`}>
                        <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                            <CardTitle className={`text-sm font-semibold tracking-tight ${section.isSecondary ? 'text-muted-foreground' : ''}`}>
                                {section.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5">
                            <div className="space-y-4">
                                {section.fields.map(({ key, value, label }) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                        <div className="font-semibold text-sm sm:w-[140px] flex-shrink-0 text-foreground/80">{label}</div>
                                        <div className="flex-1 text-sm overflow-hidden">
                                            <PropertyViewer value={value} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
