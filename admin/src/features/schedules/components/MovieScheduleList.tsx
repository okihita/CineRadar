"use client";

import { useState } from "react";
import { MovieSchedule, countMovieShowtimes, countAvailableMovieShowtimes } from "../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, Clock } from "lucide-react";
import Image from "next/image";
import { ShowtimeDistributionChart } from "./ShowtimeDistributionChart";
import { CityShowtimesTable } from "./CityShowtimesTable";
import { cn } from "@/lib/utils";

interface MovieScheduleListProps {
    movies: MovieSchedule[];
    isLoading: boolean;
}

export function MovieScheduleList({ movies, isLoading }: MovieScheduleListProps) {
    const [expandedMovieId, setExpandedMovieId] = useState<string | null>(null);

    if (isLoading) {
        return <div className="text-center py-10 text-muted-foreground">Loading schedules...</div>;
    }

    if (movies.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No schedules found for this date.</div>;
    }

    const toggleMovie = (id: string) => {
        setExpandedMovieId(expandedMovieId === id ? null : id);
    };

    return (
        <div className="space-y-2">
            {movies.map((movie) => {
                const isExpanded = expandedMovieId === movie.movie_id;
                const cityCount = movie.cities ? Object.keys(movie.cities).length : 0;
                const totalShowtimes = movie.cities ? countMovieShowtimes(movie.cities) : 0;
                const availableShowtimes = movie.cities ? countAvailableMovieShowtimes(movie.cities) : 0;

                return (
                    <Card key={movie.movie_id} className={cn("overflow-hidden transition-colors border-border/60 shadow-sm py-0", isExpanded ? "border-primary bg-primary/5" : "")}>
                        <div
                            className={cn(
                                "px-3 py-3 flex gap-4 cursor-pointer transition-colors",
                                isExpanded ? "" : "hover:bg-muted/30"
                            )}
                            onClick={() => toggleMovie(movie.movie_id)}
                        >
                            {/* Poster */}
                            <div className="relative w-16 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                                {movie.poster ? (
                                    <Image
                                        src={movie.poster}
                                        alt={movie.title}
                                        fill
                                        className="object-cover"
                                        sizes="64px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight truncate pr-2">{movie.title}</h3>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {movie.age_category && <Badge variant="outline" className="text-[10px] h-5">{movie.age_category}</Badge>}
                                            {movie.is_presale && <Badge className="text-[10px] h-5 bg-amber-500 hover:bg-amber-600">Presale</Badge>}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </div>

                                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{cityCount} cities</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>
                                            <span className="text-foreground font-medium">{availableShowtimes}</span>
                                            <span className="text-muted-foreground/60"> / {totalShowtimes}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                                            totalShowtimes > 0 && (availableShowtimes / totalShowtimes) > 0.5 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            {totalShowtimes > 0 ? ((availableShowtimes / totalShowtimes) * 100).toFixed(0) : 0}% bookable
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="border-t border-border/60 p-4">
                                <div className="space-y-6">
                                    <ShowtimeDistributionChart cityData={movie.cities} />
                                    <CityShowtimesTable cityData={movie.cities} />
                                </div>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
