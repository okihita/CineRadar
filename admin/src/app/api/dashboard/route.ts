import { NextResponse } from 'next/server';

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function getMockData() {
    return {
        greeting: getGreeting(),
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        timestamp: new Date().toISOString(),
        kpis: {
            revenue: { value: 2450000000, delta: '+12.5' },
            tickets: { value: 45200, delta: '+8.3' },
            occupancy: { value: 68, delta: '+5' },
            topTheatre: 'Grand Indonesia XXI',
        },
        alerts: [
            { type: 'warning', title: '12 showtimes below 30% occupancy', action: 'Push Flash Sale', link: '/audience' },
            { type: 'success', title: 'AVATAR premiere tomorrow', subtitle: '85% pre-sold', action: 'View Details', link: '/movies' },
            { type: 'danger', title: 'Medan underperforming', subtitle: '42% avg occupancy', action: 'View Details', link: '/location' },
        ],
        timeline: [
            { hour: '10:00', occupancy: 32, status: 'slow', note: 'Morning slow' },
            { hour: '12:00', occupancy: 45, status: 'normal', note: 'Lunch pickup' },
            { hour: '14:00', occupancy: 48, status: 'normal', note: 'Afternoon steady' },
            { hour: '16:00', occupancy: 55, status: 'normal', note: 'Building up' },
            { hour: '18:00', occupancy: 72, status: 'peak', note: 'Prime time starts', current: true },
            { hour: '19:00', occupancy: 85, status: 'peak', note: 'Peak performance' },
            { hour: '20:00', occupancy: 78, status: 'peak', note: 'Strong momentum' },
            { hour: '21:00', occupancy: 65, status: 'normal', note: 'Late shows' },
        ],
        hotMovies: [
            { title: 'SIKSA NERAKA', genre: 'Horror', occupancy: 82, revenue: 450000000 },
            { title: 'AGAK LAEN 2', genre: 'Comedy', occupancy: 78, revenue: 380000000 },
            { title: 'AVATAR 3', genre: 'Sci-Fi', occupancy: 75, revenue: 520000000 },
            { title: 'PENGABDI SETAN 3', genre: 'Horror', occupancy: 71, revenue: 290000000 },
            { title: 'DILAN 2025', genre: 'Romance', occupancy: 65, revenue: 210000000 },
        ],
        topTheatres: [
            { name: 'Grand Indonesia XXI', chain: 'XXI', revenue: 890000000, occupancy: 78 },
            { name: 'Plaza Senayan XXI', chain: 'XXI', revenue: 720000000, occupancy: 72 },
            { name: 'CGV Grand Indonesia', chain: 'CGV', revenue: 680000000, occupancy: 70 },
            { name: 'Cinépolis Lippo Mall Puri', chain: 'Cinépolis', revenue: 540000000, occupancy: 68 },
            { name: 'XXI Pakuwon Mall', chain: 'XXI', revenue: 480000000, occupancy: 65 },
        ],
        cityPerformance: [
            { name: 'Jakarta', region: 'Java', occupancy: 72, revenue: 4500000000 },
            { name: 'Surabaya', region: 'Java', occupancy: 68, revenue: 1800000000 },
            { name: 'Bandung', region: 'Java', occupancy: 65, revenue: 1200000000 },
            { name: 'Medan', region: 'Sumatra', occupancy: 58, revenue: 850000000 },
            { name: 'Makassar', region: 'Sulawesi', occupancy: 55, revenue: 620000000 },
        ],
        aiInsight: { type: 'revenue', text: 'Morning shows (10-12) have 40% lower occupancy. Consider "Early Bird" pricing at Rp35K to boost attendance.' },
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
