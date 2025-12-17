'use client';

/**
 * Export utilities for CSV and PDF generation
 */

// Convert array of objects to CSV string
export function toCSV<T extends Record<string, unknown>>(data: T[], columns?: { key: keyof T; label: string }[]): string {
    if (!data.length) return '';

    const keys = columns?.map(c => c.key) || Object.keys(data[0]) as (keyof T)[];
    const headers = columns?.map(c => c.label) || keys.map(String);

    const rows = data.map(row =>
        keys.map(key => {
            const value = row[key];
            // Handle special characters in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return String(value ?? '');
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

// Download CSV file
export function downloadCSV(data: string, filename: string) {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Export table data as CSV
export function exportTableAsCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: { key: keyof T; label: string }[]
) {
    const csv = toCSV(data, columns);
    downloadCSV(csv, filename);
}

// Generate simple HTML report for printing
export function generatePrintableReport(title: string, content: string): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - CineRadar Report</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; }
        h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #dc2626; }
        .timestamp { color: #6b7280; font-size: 12px; margin-top: 40px; }
        .mock-badge { background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 12px; display: inline-block; margin-left: 10px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>${title} <span class="mock-badge">Mock Data</span></h1>
      ${content}
      <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
      <script>window.print();</script>
    </body>
    </html>
  `);
    printWindow.document.close();
}

// Export chart as image (using canvas)
export async function exportChartAsImage(chartElement: HTMLElement, filename: string): Promise<void> {
    try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(chartElement);
        const link = document.createElement('a');
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to export chart:', error);
        alert('Failed to export chart. Please try again.');
    }
}
