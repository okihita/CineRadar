'use client';

import { cn } from '@/lib/utils';

interface ForensicAuditProgressProps {
    auditedCount: number;
    totalCount: number;
    size?: 'sm' | 'md' | 'lg';
}

export function ForensicAuditProgress({ auditedCount, totalCount, size = 'md' }: ForensicAuditProgressProps) {
    const progress = totalCount > 0 ? (auditedCount / totalCount) * 100 : 0;
    const isComplete = progress >= 100;

    const sizeClasses = {
        sm: 'w-12 h-1',
        md: 'w-16 h-1',
        lg: 'w-24 h-1.5'
    };

    return (
        <div className="flex items-center justify-center gap-2">
            <div className={cn("bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
                <div 
                    className={cn(
                        "h-full transition-all duration-1000",
                        isComplete ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-amber-500"
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <span className="text-[9px] font-black font-mono text-muted-foreground/60">
                {progress.toFixed(0)}%
            </span>
        </div>
    );
}
