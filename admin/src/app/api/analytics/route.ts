import { NextResponse } from 'next/server';

// Generate cohort analysis data
function generateCohortData() {
    const cohorts = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    for (let i = 0; i < 6; i++) {
        const cohort: Record<string, number | string> = { month: months[i], new_users: Math.floor(Math.random() * 5000) + 3000 };
        for (let j = i; j < 6; j++) {
            const retention = Math.pow(0.85, j - i) * 100 + Math.random() * 10 - 5;
            cohort[`month_${j - i}`] = Math.max(0, Math.min(100, retention)).toFixed(1);
        }
        cohorts.push(cohort);
    }
    return cohorts;
}

// Generate funnel data
function generateFunnelData() {
    return [
        { stage: 'App Open', users: 100000, percentage: 100 },
        { stage: 'Browse Movies', users: 75000, percentage: 75 },
        { stage: 'Select Showtime', users: 45000, percentage: 45 },
        { stage: 'Choose Seats', users: 32000, percentage: 32 },
        { stage: 'Checkout', users: 28000, percentage: 28 },
        { stage: 'Payment Success', users: 25000, percentage: 25 },
    ];
}

// Generate seat heatmap data
function generateSeatHeatmap() {
    const rows = 'ABCDEFGHIJ'.split('');
    const heatmap = [];

    for (const row of rows) {
        for (let seat = 1; seat <= 20; seat++) {
            // Center seats are more popular
            const distanceFromCenter = Math.abs(seat - 10.5);
            const rowPopularity = row >= 'D' && row <= 'G' ? 1.3 : 1;
            const basePopularity = (1 - distanceFromCenter / 10) * rowPopularity;
            const occupancy = Math.min(95, Math.max(20, basePopularity * 70 + Math.random() * 30));

            heatmap.push({
                row,
                seat,
                seatId: `${row}${seat}`,
                occupancy_pct: occupancy.toFixed(1),
                avg_price: Math.round(50000 + occupancy * 500),
            });
        }
    }
    return heatmap;
}

// Generate what-if scenario data
function generateWhatIfScenarios() {
    return {
        current: {
            avg_price: 55000,
            avg_occupancy: 56,
            revenue: 2500000000,
        },
        scenarios: [
            { name: '-20% Price', price: 44000, predicted_occupancy: 72, predicted_revenue: 2530000000, delta: '+1.2%' },
            { name: '-10% Price', price: 49500, predicted_occupancy: 64, predicted_revenue: 2534000000, delta: '+1.4%' },
            { name: 'Current', price: 55000, predicted_occupancy: 56, predicted_revenue: 2500000000, delta: '0%' },
            { name: '+10% Price', price: 60500, predicted_occupancy: 49, predicted_revenue: 2380000000, delta: '-4.8%' },
            { name: '+20% Price', price: 66000, predicted_occupancy: 42, predicted_revenue: 2220000000, delta: '-11.2%' },
        ],
        elasticity: -0.8, // 1% price increase = 0.8% occupancy decrease
    };
}

// Generate anomaly data
function generateAnomalies() {
    return [
        { date: '2024-12-15', type: 'spike', metric: 'Occupancy', value: '+45%', location: 'JAKARTA XXI 5', cause: 'AVATAR premiere' },
        { date: '2024-12-10', type: 'drop', metric: 'Revenue', value: '-32%', location: 'PONTIANAK', cause: 'Local holiday' },
        { date: '2024-12-08', type: 'spike', metric: 'Concession', value: '+28%', location: 'SURABAYA CGV 2', cause: 'Promo bundle' },
        { date: '2024-12-05', type: 'drop', metric: 'Occupancy', value: '-25%', location: 'ALL', cause: 'Weekday pattern' },
    ];
}

// Generate forecast data
function generateForecast() {
    const forecast = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const baseOccupancy = isWeekend ? 72 : 48;
        const baseRevenue = isWeekend ? 180000000 : 95000000;

        forecast.push({
            date: date.toISOString().split('T')[0],
            day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            predicted_occupancy: baseOccupancy + Math.random() * 10 - 5,
            predicted_revenue: baseRevenue + Math.random() * 20000000 - 10000000,
            confidence: 0.85 - i * 0.02,
        });
    }
    return forecast;
}

export async function GET() {
    try {
        return NextResponse.json({
            cohortAnalysis: generateCohortData(),
            funnel: generateFunnelData(),
            seatHeatmap: generateSeatHeatmap(),
            whatIf: generateWhatIfScenarios(),
            anomalies: generateAnomalies(),
            forecast: generateForecast(),
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to generate analytics data' }, { status: 500 });
    }
}
