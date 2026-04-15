/**
 * Social Handle Badges Component
 * 
 * Displays social media handles as clickable badges.
 * Part of Phase 1 of the Social Marketing Integration Plan.
 */
'use client';

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MarketingMetadata, SOCIAL_PLATFORMS, formatHandle } from '@/features/performances/types/social';

interface SocialHandleBadgesProps {
  /** Marketing metadata containing official accounts */
  marketing?: MarketingMetadata;
  /** Whether to show the primary hashtag */
  showHashtag?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Social Handle Badges Component
 * 
 * Renders clickable badges for each social platform that has a handle configured.
 * Also displays the primary hashtag if showHashtag is true.
 */
export function SocialHandleBadges({ 
  marketing, 
  showHashtag = true,
  compact = false,
}: SocialHandleBadgesProps) {
  if (!marketing) {
    return null;
  }

  const { primary_hashtag, secondary_hashtags, official_accounts } = marketing;

  // Check if there's any social data to display
  const hasSocialData = 
    (showHashtag && (primary_hashtag || (secondary_hashtags && secondary_hashtags.length > 0))) ||
    (official_accounts?.tiktok) ||
    (official_accounts?.instagram) ||
    (official_accounts?.x);

  if (!hasSocialData) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'text-xs' : ''}`}>
      {/* Primary Hashtag Badge */}
      {showHashtag && primary_hashtag && (
        <Badge 
          variant="secondary" 
          className={`${compact ? 'text-[10px] px-1.5 py-0' : ''} cursor-default font-bold`}
        >
          {primary_hashtag}
        </Badge>
      )}

      {/* Secondary Hashtag Badges */}
      {showHashtag && secondary_hashtags && secondary_hashtags.map((tag) => (
        <Badge 
          key={tag}
          variant="outline" 
          className={`${compact ? 'text-[10px] px-1.5 py-0' : ''} cursor-default opacity-70`}
        >
          {tag}
        </Badge>
      ))}
      
      {/* Social Platform Badges */}
      {SOCIAL_PLATFORMS.map((platform) => {
        const handle = official_accounts?.[platform.id];
        if (!handle) return null;
        
        const normalizedHandle = handle.replace(/^@/, '');
        const url = `${platform.baseUrl}${normalizedHandle}`;
        
        return (
          <a
            key={platform.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 no-underline"
          >
            <Badge 
              className={`
                ${platform.color} text-white 
                ${compact ? 'text-[10px] px-1.5 py-0' : ''} 
                hover:opacity-90 transition-opacity cursor-pointer
              `}
            >
              <span className="mr-0.5">{platform.icon}</span>
              {compact ? platform.label : formatHandle(handle)}
              <ExternalLink className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} ml-0.5 opacity-70`} />
            </Badge>
          </a>
        );
      })}
    </div>
  );
}

/**
 * Compact version for use in tight spaces like table cells
 */
export function SocialHandleBadgesCompact({ marketing }: { marketing?: MarketingMetadata }) {
  return <SocialHandleBadges marketing={marketing} compact showHashtag={false} />;
}
