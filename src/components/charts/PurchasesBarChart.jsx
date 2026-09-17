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

export const PurchasesBarChart = ({ data }) => {
  const chartData = Array.isArray(data) ? data : [];

  const formatCurrency = (val) => `₹${(val / 1000).toFixed(0)}k`;

  if (chartData.length === 0 || chartData.every(d => !d.amount && !d.units)) {
    return (
      <div className="w-full h-72 flex flex-col items-center justify-center text-slate-400 text-xs font-medium">
        <p>No procurement spend recorded for this period.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="procurementBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A6E79" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#05353B" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} 
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value, name) => [
              name === 'amount' ? `₹${value.toLocaleString()}` : `${value} Units`, 
              name === 'amount' ? 'Purchase Spend' : 'Units Procured'
            ]}
            contentStyle={{ 
              backgroundColor: '#0F172A', 
              borderRadius: '12px', 
              border: '1px solid #334155', 
              color: '#F8FAFC',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
            itemStyle={{ color: '#38BDF8' }}
            labelStyle={{ color: '#94A3B8', fontWeight: 'bold' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 600 }} 
          />
          <Bar 
            dataKey="amount" 
            name="Procurement Spend (₹)" 
            fill="url(#procurementBarGrad)" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PurchasesBarChart;
