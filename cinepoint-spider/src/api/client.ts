/**
 * Cinepoint API Client
 * 
 * Handles authentication and requests to the Cinepoint BFF API.
 * Requires CINEPOINT_ACCESS_TOKEN environment variable.
 */

const BASE_URL = 'https://cinepoint.com/bff/v1';
const DEFAULT_DELAY_MS = 3000; // Slower to avoid rate limiting
const MAX_RETRIES = 3;

interface RequestOptions {
    params?: Record<string, string | number>;
    skipDelay?: boolean;
}

class CinepointClient {
    private accessToken: string;
    private lastRequestTime: number = 0;

    constructor() {
        const token = process.env.CINEPOINT_ACCESS_TOKEN;
        if (!token) {
            throw new Error('CINEPOINT_ACCESS_TOKEN environment variable is required');
        }
        this.accessToken = token;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async rateLimitedRequest(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < DEFAULT_DELAY_MS) {
            await this.delay(DEFAULT_DELAY_MS - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();
    }

    async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        if (!options.skipDelay) {
            await this.rateLimitedRequest();
        }

        const url = new URL(`${BASE_URL}${endpoint}`);
        if (options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.set(key, String(value));
            });
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                // Exponential backoff: 5s, 10s, 20s
                const backoff = 5000 * Math.pow(2, attempt);
                console.log(`[API] Retry ${attempt}/${MAX_RETRIES}, waiting ${backoff / 1000}s...`);
                await this.delay(backoff);
            }

            console.log(`[API] GET ${url.pathname}${url.search}`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'CineRadar-Spider/1.0'
                }
            });

            if (response.status === 429) {
                console.log(`[API] Rate limited (429), will retry...`);
                lastError = new Error('Rate limited');
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error ${response.status}: ${text}`);
            }

            const data = await response.json();
            return data as T;
        }

        throw lastError || new Error('Max retries exceeded');
    }

    // Daily Showtime endpoints
    async getDailyShowtime(date: string, page = 0, limit = 50) {
        return this.get<{ data: { items: any[]; total: number } }>('/movies/daily-showtime', {
            params: { date_end: date, page, limit }
        });
    }

    async getShowtimeGraph(movieIds: number[], dateEnd: string) {
        return this.get<{ data: any }>('/movies/daily-showtime/graph', {
            params: { movie_ids: movieIds.join(','), date_end: dateEnd }
        });
    }

    // Box Office endpoints
    async getDailyBoxOffice(page = 0, limit = 50, type = 'all') {
        return this.get<{ data: { items: any[]; total: number } }>('/home/box-office/daily', {
            params: { page, limit, type }
        });
    }

    async getBoxOfficeDetail(movieId: number, period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
        return this.get<{ data: any }>(`/movies/top-box-office/${period}/detail`, {
            params: { movie_id: movieId }
        });
    }

    // Movie Directory endpoints
    async getMovieDirectory(page = 0, limit = 50, status?: string) {
        const params: Record<string, string | number> = { page, limit };
        if (status) params.status = status;
        return this.get<{ data: { items: any[]; total: number } }>('/movies/directory', { params });
    }

    async getMovieDetail(movieId: number) {
        return this.get<{ data: any }>(`/movies/directory/detail/${movieId}`);
    }

    // Insights endpoints
    async getInsights(page = 0, limit = 20) {
        return this.get<{ data: { items: any[]; total: number } }>('/insights', {
            params: { page, limit }
        });
    }

    async getInsightDetail(slug: string) {
        return this.get<{ data: any }>(`/insights/${slug}`);
    }
}

// Singleton instance
let clientInstance: CinepointClient | null = null;

export function getClient(): CinepointClient {
    if (!clientInstance) {
        clientInstance = new CinepointClient();
    }
    return clientInstance;
}

export { CinepointClient };
