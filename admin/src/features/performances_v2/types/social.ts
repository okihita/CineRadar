/**
 * Social Marketing Types
 * 
 * Type definitions for social marketing metadata and metrics.
 * Used in Phase 1 of the Social Marketing Integration Plan.
 */

/**
 * Social platform configuration for badge display
 */
export interface SocialPlatformConfig {
  id: 'tiktok' | 'instagram' | 'x';
  label: string;
  baseUrl: string;
  color: string;
  icon: string;
}

/**
 * Platform configurations for rendering social badges
 */
export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    baseUrl: 'https://www.tiktok.com/@',
    color: 'bg-black hover:bg-gray-800',
    icon: '🎵',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    baseUrl: 'https://www.instagram.com/',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    icon: '📷',
  },
  {
    id: 'x',
    label: 'X',
    baseUrl: 'https://x.com/',
    color: 'bg-gray-900 hover:bg-gray-700',
    icon: '𝕏',
  },
];

/**
 * Static marketing metadata stored on movie documents
 */
export interface MarketingMetadata {
  /** Primary campaign hashtag (e.g., "#PengabdiSetan3") */
  primary_hashtag: string;
  /** Supporting hashtags (max 5) */
  secondary_hashtags: string[];
  /** Official social media accounts */
  official_accounts: {
    tiktok?: string;
    instagram?: string;
    x?: string;
  };
  /** Campaign start date for ROI calculation (ISO date string) */
  campaign_start_date?: string;
  /** Marketing budget in IDR for ROI calculation */
  marketing_budget?: number;
}

/**
 * Form data for editing marketing metadata
 */
export interface MarketingFormData {
  primary_hashtag: string;
  secondary_hashtags: string[];
  tiktok_handle: string;
  instagram_handle: string;
  x_handle: string;
  campaign_start_date: string;
  marketing_budget: string;
}

/**
 * Default empty marketing form data
 */
export const DEFAULT_MARKETING_FORM: MarketingFormData = {
  primary_hashtag: '',
  secondary_hashtags: [],
  tiktok_handle: '',
  instagram_handle: '',
  x_handle: '',
  campaign_start_date: '',
  marketing_budget: '',
};

/**
 * Helper to normalize handle input (remove @ prefix if present)
 */
export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim();
}

/**
 * Helper to format handle for display (add @ prefix)
 */
export function formatHandle(handle: string): string {
  const normalized = normalizeHandle(handle);
  return normalized ? `@${normalized}` : '';
}

/**
 * Helper to validate hashtag format
 */
export function isValidHashtag(hashtag: string): boolean {
  return /^#[\w\u0080-\uFFFF]+$/.test(hashtag);
}

/**
 * Helper to normalize hashtag (ensure # prefix)
 */
export function normalizeHashtag(hashtag: string): string {
  const trimmed = hashtag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Convert MarketingFormData to MarketingMetadata for API submission
 */
export function formToMetadata(form: MarketingFormData): MarketingMetadata {
  const marketingBudget = form.marketing_budget
    ? parseInt(form.marketing_budget.replace(/\D/g, ''), 10)
    : undefined;
  
  return {
    primary_hashtag: normalizeHashtag(form.primary_hashtag),
    secondary_hashtags: form.secondary_hashtags
      .map(normalizeHashtag)
      .filter(Boolean)
      .slice(0, 5),
    official_accounts: {
      tiktok: normalizeHandle(form.tiktok_handle) || undefined,
      instagram: normalizeHandle(form.instagram_handle) || undefined,
      x: normalizeHandle(form.x_handle) || undefined,
    },
    campaign_start_date: form.campaign_start_date || undefined,
    marketing_budget: marketingBudget && !isNaN(marketingBudget) ? marketingBudget : undefined,
  };
}

/**
 * Convert MarketingMetadata to MarketingFormData for form initialization
 */
export function metadataToForm(metadata?: MarketingMetadata): MarketingFormData {
  if (!metadata) {
    return { ...DEFAULT_MARKETING_FORM };
  }
  
  return {
    primary_hashtag: metadata.primary_hashtag || '',
    secondary_hashtags: metadata.secondary_hashtags || [],
    tiktok_handle: metadata.official_accounts?.tiktok || '',
    instagram_handle: metadata.official_accounts?.instagram || '',
    x_handle: metadata.official_accounts?.x || '',
    campaign_start_date: metadata.campaign_start_date || '',
    marketing_budget: metadata.marketing_budget?.toString() || '',
  };
}
