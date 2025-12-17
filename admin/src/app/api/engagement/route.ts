import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

// Mock engagement data (will be generated on the fly)
function generateMockEngagementData() {
    const promoTypes = ['Flash Sale', 'Early Bird', 'Bundle Deal', 'Loyalty Reward', 'Partner Promo'];
    const channels = ['App Push', 'Email', 'SMS', 'Social Media', 'In-Theatre'];

    // Promo performance
    const promoPerformance = promoTypes.map((promo, i) => ({
        promo_type: promo,
        campaigns: Math.floor(Math.random() * 20) + 5,
        redemptions: Math.floor(Math.random() * 5000) + 1000,
        revenue_impact: Math.floor(Math.random() * 500000000) + 100000000,
        roi: (Math.random() * 3 + 1).toFixed(1) + 'x',
    }));

    // Channel effectiveness
    const channelEffectiveness = channels.map((channel) => ({
        channel,
        sent: Math.floor(Math.random() * 50000) + 10000,
        opened: Math.floor(Math.random() * 25000) + 5000,
        clicked: Math.floor(Math.random() * 10000) + 1000,
        converted: Math.floor(Math.random() * 2000) + 200,
        open_rate: (Math.random() * 30 + 20).toFixed(1),
        ctr: (Math.random() * 15 + 5).toFixed(1),
        conversion_rate: (Math.random() * 5 + 1).toFixed(1),
    }));

    // Loyalty tiers
    const loyaltyTiers = [
        { tier: 'Bronze', members: 125000, avg_visits_month: 1.2, avg_spend: 85000, churn_risk: 'High' },
        { tier: 'Silver', members: 45000, avg_visits_month: 2.5, avg_spend: 150000, churn_risk: 'Medium' },
        { tier: 'Gold', members: 12000, avg_visits_month: 4.8, avg_spend: 280000, churn_risk: 'Low' },
        { tier: 'Platinum', members: 3500, avg_visits_month: 8.2, avg_spend: 520000, churn_risk: 'Very Low' },
    ];

    // CLV by segment
    const clvSegments = [
        { segment: 'Casual Viewers', members: 80000, avg_clv: 450000, annual_revenue: 36000000000 },
        { segment: 'Regular Moviegoers', members: 55000, avg_clv: 1200000, annual_revenue: 66000000000 },
        { segment: 'Enthusiasts', members: 25000, avg_clv: 2800000, annual_revenue: 70000000000 },
        { segment: 'Super Fans', members: 8000, avg_clv: 5500000, annual_revenue: 44000000000 },
    ];

    // AB Test Results
    const abTests = [
        {
            test_name: 'Flash Sale Timing',
            variant_a: '2 hours before',
            variant_b: '1 hour before',
            metric: 'Conversion Rate',
            result_a: '4.2%',
            result_b: '6.8%',
            winner: 'B',
            lift: '+62%',
        },
        {
            test_name: 'Discount Depth',
            variant_a: '20% off',
            variant_b: '30% off',
            metric: 'Revenue per Campaign',
            result_a: 'Rp85M',
            result_b: 'Rp78M',
            winner: 'A',
            lift: '+9%',
        },
        {
            test_name: 'CTA Button Color',
            variant_a: 'Blue',
            variant_b: 'Red',
            metric: 'Click Rate',
            result_a: '12.4%',
            result_b: '14.1%',
            winner: 'B',
            lift: '+14%',
        },
    ];

    // Monthly engagement trend
    const engagementTrend = [];
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        engagementTrend.push({
            month: date.toISOString().slice(0, 7),
            active_members: Math.floor(Math.random() * 20000) + 80000,
            app_opens: Math.floor(Math.random() * 100000) + 200000,
            purchases: Math.floor(Math.random() * 30000) + 50000,
        });
    }

    return {
        promoPerformance,
        channelEffectiveness,
        loyaltyTiers,
        clvSegments,
        abTests,
        engagementTrend,
    };
}

export async function GET() {
    try {
        // Generate mock engagement data
        const data = generateMockEngagementData();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error generating engagement data:', error);
        return NextResponse.json({ error: 'Failed to load engagement data' }, { status: 500 });
    }
}
