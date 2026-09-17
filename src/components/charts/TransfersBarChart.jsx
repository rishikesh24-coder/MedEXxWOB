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

export const TransfersBarChart = ({ data }) => {
  const chartData = data || [
    { month: 'Mar', transfers: 180, volumeINR: 980000 },
    { month: 'Apr', transfers: 220, volumeINR: 1250000 },
    { month: 'May', transfers: 260, volumeINR: 1480000 },
    { month: 'Jun', transfers: 290, volumeINR: 1620000 },
    { month: 'Jul', transfers: 310, volumeINR: 1740000 },
    { month: 'Aug', transfers: 324, volumeINR: 1840000 },
  ];

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value, name) => [
              name === 'transfers' ? `${value} Batches` : `₹${(value / 100000).toFixed(2)} Lakhs`,
              name === 'transfers' ? 'Inter-Hospital Transfers' : 'Trade Value'
            ]}
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          <Bar 
            dataKey="transfers" 
            name="Completed Transfers" 
            fill="#0A6E79" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={42}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TransfersBarChart;
