/**
 * API Validation Script
 * 
 * Tests each endpoint and logs the raw response structure.
 * Run: npx tsx scripts/validate-api.ts
 */

const BASE_URL = 'https://cinepoint.com/bff/v1';

async function fetchEndpoint(endpoint: string, params: Record<string, string | number> = {}) {
    const token = process.env.CINEPOINT_ACCESS_TOKEN;
    if (!token) {
        throw new Error('CINEPOINT_ACCESS_TOKEN is required');
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    console.log(`\n🔍 Testing: ${endpoint}`);
    console.log(`   URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const text = await response.text();
        console.log(`   ❌ Error: ${text}`);
        return null;
    }

    const data = await response.json();
    return data;
}

function summarizeData(data: any, depth = 0): void {
    const indent = '   '.repeat(depth + 1);

    if (Array.isArray(data)) {
        console.log(`${indent}Array[${data.length}]`);
        if (data.length > 0) {
            console.log(`${indent}First item keys: ${Object.keys(data[0]).join(', ')}`);
        }
    } else if (typeof data === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                console.log(`${indent}${key}: Array[${value.length}]`);
                if (value.length > 0 && typeof value[0] === 'object') {
                    console.log(`${indent}  First item keys: ${Object.keys(value[0]).join(', ')}`);
                }
            } else if (typeof value === 'object' && value !== null) {
                console.log(`${indent}${key}: Object { ${Object.keys(value).slice(0, 5).join(', ')}${Object.keys(value).length > 5 ? '...' : ''} }`);
            } else {
                const preview = String(value).slice(0, 50);
                console.log(`${indent}${key}: ${typeof value} = ${preview}${String(value).length > 50 ? '...' : ''}`);
            }
        }
    }
}

async function validateApi() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   CINEPOINT API VALIDATION                 ║');
    console.log('╚════════════════════════════════════════════╝');

    // 1. Movie Directory
    console.log('\n\n📽️  1. MOVIE DIRECTORY');
    const movies = await fetchEndpoint('/movies/directory', { page: 0, limit: 5 });
    if (movies) {
        summarizeData(movies);
        console.log('\n   Sample movie:');
        if (movies.data?.items?.[0]) {
            console.log(JSON.stringify(movies.data.items[0], null, 2).split('\n').map((l: string) => '   ' + l).join('\n'));
        }
    }

    await delay(3000);

    // 2. Daily Showtime
    console.log('\n\n📊 2. DAILY SHOWTIME');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const showtimes = await fetchEndpoint('/movies/daily-showtime', { date_end: dateStr, page: 0, limit: 5 });
    if (showtimes) {
        summarizeData(showtimes);
        console.log('\n   Sample showtime:');
        if (showtimes.data?.items?.[0]) {
            console.log(JSON.stringify(showtimes.data.items[0], null, 2).split('\n').map((l: string) => '   ' + l).join('\n'));
        }
    }

    await delay(3000);

    // 3. Box Office Daily
    console.log('\n\n🎬 3. BOX OFFICE DAILY');
    const boxOffice = await fetchEndpoint('/home/box-office/daily', { page: 0, limit: 5, type: 'all' });
    if (boxOffice) {
        summarizeData(boxOffice);
        console.log('\n   Sample box office:');
        if (boxOffice.data?.items?.[0]) {
            console.log(JSON.stringify(boxOffice.data.items[0], null, 2).split('\n').map((l: string) => '   ' + l).join('\n'));
        }
    }

    await delay(3000);

    // 4. Insights
    console.log('\n\n📰 4. INSIGHTS');
    const insights = await fetchEndpoint('/insights', { page: 0, limit: 3 });
    if (insights) {
        summarizeData(insights);
        console.log('\n   Sample insight:');
        if (insights.data?.items?.[0]) {
            const sample = { ...insights.data.items[0] };
            if (sample.content) sample.content = sample.content.slice(0, 100) + '...';
            console.log(JSON.stringify(sample, null, 2).split('\n').map((l: string) => '   ' + l).join('\n'));
        }
    }

    console.log('\n\n╔════════════════════════════════════════════╗');
    console.log('║   VALIDATION COMPLETE                      ║');
    console.log('╚════════════════════════════════════════════╝\n');
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

validateApi().catch(console.error);
