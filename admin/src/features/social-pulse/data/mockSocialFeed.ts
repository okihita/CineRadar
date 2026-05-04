/**
 * Mock social feed data for the Industry Feed MVP.
 * 
 * Represents curated posts from Indonesian cinema ecosystem accounts:
 * critics, cinema chains, distributors, and movie review channels.
 */

export type SocialPlatform = 'twitter' | 'instagram' | 'youtube' | 'tiktok';
export type AccountCategory = 'critic' | 'cinema_chain' | 'distributor' | 'community';

export interface SocialAccount {
    id: string;
    handle: string;
    display_name: string;
    platform: SocialPlatform;
    category: AccountCategory;
    avatar_url?: string;
    follower_count: string;
    verified: boolean;
}

export interface SocialPost {
    id: string;
    account_id: string;
    content: string;
    timestamp: string; // ISO
    metrics: {
        likes: number;
        retweets?: number;
        comments: number;
        views: string;
    };
    hashtags: string[];
    media_url?: string;
    url: string;
}

// ─── Accounts ──────────────────────────────────────────

export const ACCOUNTS: SocialAccount[] = [
    // Critics / Reviewers
    {
        id: 'cine-crib',
        handle: '@cinecribid',
        display_name: 'Cine Crib',
        platform: 'youtube',
        category: 'critic',
        follower_count: '1.2M',
        verified: true,
    },
    {
        id: 'film-kolektif',
        handle: '@filmkolektif',
        display_name: 'Film Kolektif',
        platform: 'twitter',
        category: 'critic',
        follower_count: '340K',
        verified: true,
    },
    {
        id: 'joker-review',
        handle: '@jokerreviewid',
        display_name: 'Joker Review',
        platform: 'youtube',
        category: 'critic',
        follower_count: '890K',
        verified: false,
    },
    {
        id: 'review-film-id',
        handle: '@reviewfilmid',
        display_name: 'Review Film Indonesia',
        platform: 'instagram',
        category: 'critic',
        follower_count: '560K',
        verified: true,
    },
    // Cinema Chains
    {
        id: 'cgv-id',
        handle: '@CGV_ID',
        display_name: 'CGV Cinemas Indonesia',
        platform: 'twitter',
        category: 'cinema_chain',
        follower_count: '2.1M',
        verified: true,
    },
    {
        id: 'cinemaxx-id',
        handle: '@CinemaxxID',
        display_name: 'Cinemaxx',
        platform: 'instagram',
        category: 'cinema_chain',
        follower_count: '1.8M',
        verified: true,
    },
    {
        id: 'xxi-official',
        handle: '@CinemaXXI',
        display_name: 'Cinema XXI',
        platform: 'twitter',
        category: 'cinema_chain',
        follower_count: '3.4M',
        verified: true,
    },
    // Distributors
    {
        id: 'md-pictures',
        handle: '@MDPictures',
        display_name: 'MD Pictures',
        platform: 'twitter',
        category: 'distributor',
        follower_count: '780K',
        verified: true,
    },
    {
        id: 'riva-pictures',
        handle: '@riva_pictures',
        display_name: 'Rapi Films',
        platform: 'instagram',
        category: 'distributor',
        follower_count: '420K',
        verified: true,
    },
    {
        id: 'star-movies',
        handle: '@StarMoviesPlus',
        display_name: 'Star Movies+',
        platform: 'twitter',
        category: 'distributor',
        follower_count: '290K',
        verified: false,
    },
    // Community / Fan accounts
    {
        id: 'bioskopmania',
        handle: '@bioskopmania',
        display_name: 'Bioskop Mania',
        platform: 'twitter',
        category: 'community',
        follower_count: '150K',
        verified: false,
    },
    {
        id: 'film-twitter-id',
        handle: '@FilmTwitterID',
        display_name: 'Film Twitter Indonesia',
        platform: 'twitter',
        category: 'community',
        follower_count: '85K',
        verified: false,
    },
];

// ─── Posts ──────────────────────────────────────────────

const NOW = new Date().toISOString();

export const POSTS: SocialPost[] = [
    // Critics
    {
        id: 'p1',
        account_id: 'cine-crib',
        content: 'DILAN 1997 berhasil bawa nostalgia tanpa terasa forced. Score acting Dilan baru 8/10. Tapi chemistry dengan Milea? 🔥🔥🔥 Full review besok di channel!',
        timestamp: NOW,
        metrics: { likes: 12400, retweets: 3200, comments: 890, views: '450K' },
        hashtags: ['Dilan1997', 'ReviewFilm', 'Bioskop'],
        url: 'https://youtube.com',
    },
    {
        id: 'p2',
        account_id: 'film-kolektif',
        content: 'Thread: 5 film Indonesia yang punya potential buat beat box office record tahun ini. 🧵\n\n1. DILAN 1997 — Nostalgia factor alone guarantees opening weekend\n2. VINA — True crime horror selalu jadi magnet\n3-5 di thread👇',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        metrics: { likes: 8900, retweets: 5600, comments: 1200, views: '1.2M' },
        hashtags: ['FilmIndonesia', 'BoxOffice', 'Thread'],
        url: 'https://twitter.com',
    },
    {
        id: 'p3',
        account_id: 'joker-review',
        content: 'Kalian udah nonton VINA belum? Ini film yang proof kalau horror Indonesia bisa lebih dari lompat-lompatan. Social commentary-nya kena banget. 9/10. 🎬',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        metrics: { likes: 6700, retweets: 1800, comments: 450, views: '320K' },
        hashtags: ['VinaFilm', 'HorrorIndonesia', 'Review'],
        url: 'https://youtube.com',
    },
    {
        id: 'p4',
        account_id: 'review-film-id',
        content: '📸 Behind the scene DILAN 1997 — Perbandingan lokasi syuting vs scene aslinya. Meticulous banget detail production design-nya!\n\n#Dilan1997 #BehindTheScene #FilmIndonesia',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        metrics: { likes: 15200, comments: 890, views: '680K' },
        hashtags: ['Dilan1997', 'BehindTheScene', 'FilmIndonesia'],
        media_url: '/placeholder.jpg',
        url: 'https://instagram.com',
    },
    // Cinema Chains
    {
        id: 'p5',
        account_id: 'cgv-id',
        content: '🔥 HOTSALE! Beli 1 Gratis 1 tiket DILAN 1997 untuk showtime jam 10:00-14:00 weekday! Segera book via app CGV. Promo berlaku sampai akhir minggu. 🎟️',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        metrics: { likes: 23000, retweets: 8900, comments: 3400, views: '2.3M' },
        hashtags: ['CGVHotsale', 'Dilan1997', 'PromoBioskop'],
        url: 'https://twitter.com',
    },
    {
        id: 'p6',
        account_id: 'cinemaxx-id',
        content: 'Weekend prep! 🍿\n\nShowtimes terbaru VINA: SEBELUM 7 HARI sudah available di semua branch Cinemaxx. Book early — showtimes jam malam sudah 90% full di Jakarta dan Bandung.',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        metrics: { likes: 8700, comments: 1200, views: '450K' },
        hashtags: ['Cinemaxx', 'VinaFilm', 'NowShowing'],
        url: 'https://instagram.com',
    },
    {
        id: 'p7',
        account_id: 'xxi-official',
        content: 'Pengumuman! 📢 Minggu ini ada special screening + QnA session bareng cast VINA: SEBELUM 7 HARI di Cinema XXI Plaza Indonesia. Limited seats! Info selengkapnya di bio.',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        metrics: { likes: 18000, retweets: 4200, comments: 2100, views: '1.5M' },
        hashtags: ['CinemaXXI', 'VinaFilm', 'SpecialScreening'],
        url: 'https://twitter.com',
    },
    // Distributors
    {
        id: 'p8',
        account_id: 'md-pictures',
        content: 'GRAND TOTAL Update: DILAN 1997 mencapai 2.5 juta admissions dalam 10 hari! 🏆\n\nTerima kasih kepada semua penonton yang sudah membuat film ini fenomena. Masih playing di bioskop-bioskop Indonesia.',
        timestamp: new Date(Date.now() - 9000000).toISOString(),
        metrics: { likes: 34000, retweets: 12000, comments: 5600, views: '4.8M' },
        hashtags: ['Dilan1997', 'MDPictures', 'BoxOffice'],
        url: 'https://twitter.com',
    },
    {
        id: 'p9',
        account_id: 'riva-pictures',
        content: '🎬 Official Poster Reveal — Film terbaru dari Rapi Films, coming soon di bioskop kalian. Swipe untuk lihat cast lineup 👉',
        timestamp: new Date(Date.now() - 18000000).toISOString(),
        metrics: { likes: 9400, comments: 2300, views: '780K' },
        hashtags: ['RapiFilms', 'ComingSoon', 'FilmBaru'],
        media_url: '/placeholder.jpg',
        url: 'https://instagram.com',
    },
    {
        id: 'p10',
        account_id: 'star-movies',
        content: 'Popularity chart update! 📊 Film Indonesia dominating TMDB trending:\n\n1️⃣ VINA: SEBELUM 7 HARI\n2️⃣ DILAN 1997\n3️⃣ AGAK LAEN\n\nIndonesian cinema is thriving! 🇮🇩',
        timestamp: new Date(Date.now() - 25200000).toISOString(),
        metrics: { likes: 5600, retweets: 2100, comments: 340, views: '890K' },
        hashtags: ['TMDB', 'FilmIndonesia', 'Trending'],
        url: 'https://twitter.com',
    },
    // Community
    {
        id: 'p11',
        account_id: 'bioskopmania',
        content: 'POV: Kamu sudah nonton DILAN 1997 3 kali di bioskop dan masih mau nonton lagi 😭🎬\n\nSiapa yang relate? RT kalau kamu salah satu yang buat angka admissionsnya tembus 2.5 juta!',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        metrics: { likes: 12000, retweets: 6700, comments: 1800, views: '2.1M' },
        hashtags: ['Dilan1997', 'BioskopMania', 'FilmIndonesia'],
        url: 'https://twitter.com',
    },
    {
        id: 'p12',
        account_id: 'film-twitter-id',
        content: 'Unpopular opinion: VINA: SEBELUM 7 HARI lebih bagus dari pada kebanyakan horror Korea tahun ini. Fight me. 🥊\n\nPlot twist-nya genuinely unpredictable dan social commentary-nya ga cringe.',
        timestamp: new Date(Date.now() - 50400000).toISOString(),
        metrics: { likes: 7800, retweets: 3400, comments: 4500, views: '1.8M' },
        hashtags: ['VinaFilm', 'HorrorIndonesia', 'FilmTwitter'],
        url: 'https://twitter.com',
    },
];
