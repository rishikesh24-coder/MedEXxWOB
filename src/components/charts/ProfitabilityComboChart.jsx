import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const ProfitabilityComboChart = ({ data }) => {
  const chartData = Array.isArray(data) ? data : [];

  const formatCurrency = (val) => `₹${(val / 1000).toFixed(0)}k`;
  const formatPercent = (val) => `${val}%`;

  if (chartData.length === 0 || chartData.every(d => !d.revenue && !d.cost)) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center text-slate-400 text-xs font-medium">
        <p>No margin or transaction yield data recorded for this period.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 12, right: 15, left: -5, bottom: 0 }}
        >
          <defs>
            <linearGradient id="comboRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A6E79" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#064E56" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="comboCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#64748B" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} 
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          {/* Left Y Axis for Amounts */}
          <YAxis 
            yAxisId="left"
            tickFormatter={formatCurrency}
            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          {/* Right Y Axis for Margin % */}
          <YAxis 
            yAxisId="right"
            orientation="right"
            tickFormatter={formatPercent}
            tick={{ fill: '#D97706', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 50]}
          />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'marginPercent') return [`${value}%`, 'Gross Concession Margin'];
              return [`₹${value.toLocaleString()}`, name === 'revenue' ? 'Gross Sales' : 'Procurement Spend'];
            }}
            contentStyle={{ 
              backgroundColor: '#0F172A', 
              borderRadius: '12px', 
              border: '1px solid #334155', 
              color: '#F8FAFC',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
            labelStyle={{ color: '#94A3B8', fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontWeight: 600 }} />
          
          <Bar 
            yAxisId="left" 
            dataKey="revenue" 
            name="Redistribution Sales" 
            fill="url(#comboRevenueGrad)" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={30}
          />
          <Bar 
            yAxisId="left" 
            dataKey="cost" 
            name="Procurement Spend" 
            fill="url(#comboCostGrad)" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={30}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="marginPercent" 
            name="Gross Margin %" 
            stroke="#F59E0B" 
            strokeWidth={3}
            dot={{ r: 4.5, fill: '#F59E0B', strokeWidth: 2, stroke: '#FFFFFF' }}
            activeDot={{ r: 6.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProfitabilityComboChart;
