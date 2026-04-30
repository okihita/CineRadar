import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface PieDataEntry {
    name: string;
    value: number;
    color: string;
}

interface ShareDistributionChartsProps {
    admissions: PieDataEntry[];
    showtimes: PieDataEntry[];
}

function PieChartCard({ title, description, data, label }: { title: string; description: string; data: PieDataEntry[]; label: string }) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    {data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value: any) => [Number(value).toLocaleString(), label]}
                                />
                                <Legend verticalAlign="bottom" align="center" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                            No {label.toLowerCase()} data available
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function ShareDistributionCharts({ admissions, showtimes }: ShareDistributionChartsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PieChartCard
                title="Share of Admissions"
                description="Total distribution of tickets sold"
                data={admissions}
                label="Admissions"
            />
            <PieChartCard
                title="Share of Showtimes"
                description="Total distribution of screen allocations"
                data={showtimes}
                label="Showtimes"
            />
        </div>
    );
}
