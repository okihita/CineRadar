/**
 * YouTube channel configuration for the Industry Feed.
 * 
 * Each entry maps a CineRadar account ID to a real YouTube channel.
 * Only accounts with platform='youtube' should be listed here.
 */

export interface YouTubeChannelConfig {
    account_id: string;       // Links to mockSocialFeed account ID
    channel_id: string;       // YouTube channel ID (UC...)
    display_name: string;     // Verified channel name
}

export const YOUTUBE_CHANNELS: YouTubeChannelConfig[] = [
    {
        account_id: 'cine-crib',
        channel_id: 'UCrMqntY4lAQu0JHYFl8Z0nw',
        display_name: 'Cine Crib',
    },
    {
        account_id: 'joker-review',
        channel_id: 'UC_5tCGLrVehijNbC1_G8a5w',
        display_name: 'Ngelantur Indonesia',
    },
    {
        account_id: 'cgv-id',
        channel_id: 'UC2vfMMUMoAZd-RBGwA0-9Nw',
        display_name: 'CGV Kreasi',
    },
    {
        account_id: 'xxi-official',
        channel_id: 'UCudik2UCrl1TGyyPZ2I9Pvg',
        display_name: 'CINEMA 21',
    },
    {
        account_id: 'md-pictures',
        channel_id: 'UCQExjzw5-z1VE2Fcbd3ky9Q',
        display_name: 'MD Pictures',
    },
    {
        account_id: 'riva-pictures',
        channel_id: 'UCTi-irCm6xVzft7gh9ltRNQ',
        display_name: 'Rapi Films',
    },
    {
        account_id: 'star-movies',
        channel_id: 'UCI_c_ZmYt6CtFJo4jOQVhiw',
        display_name: 'Disney+ Indonesia',
    },
    {
        account_id: 'bioskopmania',
        channel_id: 'UCHlCL5cY9PPlq2Ou9iU4NuQ',
        display_name: 'Bioskop mania',
    },
];
