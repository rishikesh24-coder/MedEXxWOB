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

export const HotMedicinesBarChart = ({ data }) => {
  const chartData = data || [
    { name: 'Meropenem 1g', exchanges: 420, valueLakhs: 7.77 },
    { name: 'Enoxaparin 40mg', exchanges: 390, valueLakhs: 1.87 },
    { name: 'Human Albumin 20%', exchanges: 310, valueLakhs: 13.02 },
    { name: 'Remdesivir 100mg', exchanges: 280, valueLakhs: 7.84 },
    { name: 'Augmentin 625mg', exchanges: 240, valueLakhs: 0.50 },
    { name: 'Pantoprazole 40mg', exchanges: 215, valueLakhs: 0.14 },
    { name: 'Trastuzumab 440mg', exchanges: 195, valueLakhs: 105.3 },
    { name: 'Insulin Glargine', exchanges: 180, valueLakhs: 1.60 },
    { name: 'Ceftriaxone 1g', exchanges: 165, valueLakhs: 0.12 },
    { name: 'Noradrenaline 2mg', exchanges: 150, valueLakhs: 0.28 },
  ];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="name" 
            angle={-35} 
            textAnchor="end"
            interval={0}
            tick={{ fill: '#64748b', fontSize: 10 }} 
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value, name) => [
              name === 'exchanges' ? `${value} Transfers` : `₹${value} Lakhs`,
              name === 'exchanges' ? 'Transfer Volume' : 'Market Turnover'
            ]}
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '12px', paddingBottom: '12px' }} />
          <Bar 
            dataKey="exchanges" 
            name="Exchanges Count" 
            fill="#F59E0B" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HotMedicinesBarChart;
