import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const PerformanceBarChart = ({ data }) => {
  const chartData = data || [
    { metric: 'Fulfillment Rate', score: 98.4, target: 95 },
    { metric: 'Cold-Chain Integrity', score: 99.1, target: 98 },
    { metric: 'Avg Transit Speed', score: 92.5, target: 90 },
    { metric: 'Verification Turnaround', score: 96.0, target: 90 },
    { metric: 'Disposal Compliance', score: 100.0, target: 100 },
  ];

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis 
            type="number" 
            domain={[0, 100]} 
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis 
            dataKey="metric" 
            type="category" 
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip 
            formatter={(value) => [`${value}%`, 'Score']}
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
          <Bar 
            dataKey="score" 
            name="Actual SLA (%)" 
            fill="#0A6E79" 
            radius={[0, 6, 6, 0]} 
            maxBarSize={22}
          />
          <Bar 
            dataKey="target" 
            name="Target SLA (%)" 
            fill="#CBD5E1" 
            radius={[0, 6, 6, 0]} 
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceBarChart;
