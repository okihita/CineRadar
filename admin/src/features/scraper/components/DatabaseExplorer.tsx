/**
 * Database Explorer component
 * Expandable collection viewer with sample documents
 */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { CollectionStats } from '../types';

interface DatabaseExplorerProps {
    collections: CollectionStats[];
    isLoading: boolean;
}

export function DatabaseExplorer({ collections, isLoading }: DatabaseExplorerProps) {
    const [expandedCollection, setExpandedCollection] = useState<string | null>(null);

    const toggleCollection = (name: string) => {
        setExpandedCollection(expandedCollection === name ? null : name);
    };

    const totalDocuments = collections.reduce((sum, c) => sum + c.count, 0);

    return (
        <Card className="mb-6">
            <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Database Explorer
                    {!isLoading && (
                        <Badge variant="secondary" className="ml-2">
                            {totalDocuments.toLocaleString()} documents
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="h-10 bg-muted animate-pulse rounded-lg" />
                        <div className="h-10 bg-muted animate-pulse rounded-lg" />
                        <div className="h-10 bg-muted animate-pulse rounded-lg" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {collections.map((col) => (
                            <div key={col.name} className="border rounded-lg overflow-hidden">
                                <button
                                    onClick={() => toggleCollection(col.name)}
                                    className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedCollection === col.name ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                        <Database className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-mono text-sm font-medium">{col.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline">{col.count.toLocaleString()} docs</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {col.fields.length} fields
                                        </span>
                                    </div>
                                </button>

                                {expandedCollection === col.name && (
                                    <div className="p-4 border-t bg-background">
                                        {/* Fields */}
                                        <div className="mb-4">
                                            <div className="text-xs font-medium text-muted-foreground mb-2">
                                                Fields:
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {col.fields.map((field) => (
                                                    <Badge key={field} variant="secondary" className="text-xs font-mono">
                                                        {field}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Sample Document */}
                                        {col.sample && (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                                    Sample Document:
                                                </div>
                                                <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                                    {JSON.stringify(col.sample, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
