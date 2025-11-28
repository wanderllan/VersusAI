
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { RadarDataPoint } from '../types';

interface ComparisonChartProps {
  data: RadarDataPoint[];
  productNames: string[];
  isDarkMode: boolean;
}

// Palette for up to 5 products
const COLORS = [
  { stroke: "#3b82f6", fill: "#3b82f6" }, // Blue
  { stroke: "#10b981", fill: "#10b981" }, // Emerald
  { stroke: "#8b5cf6", fill: "#8b5cf6" }, // Violet
  { stroke: "#f59e0b", fill: "#f59e0b" }, // Amber
  { stroke: "#ec4899", fill: "#ec4899" }, // Pink
];

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, productNames, isDarkMode }) => {
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const textColor = isDarkMode ? "#94a3b8" : "#64748b";
  const tooltipBg = isDarkMode ? "#1e293b" : "#fff";
  const tooltipBorder = isDarkMode ? "#334155" : "#e2e8f0";
  const tooltipText = isDarkMode ? "#f8fafc" : "#1e293b";

  return (
    <div className="w-full h-[400px] bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-100 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 text-center">Análise de Pontuação</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: textColor, fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          
          {productNames.map((name, index) => (
            <Radar
              key={index}
              name={name}
              dataKey={`prod${index}`} // Matches the JSON key "prod0", "prod1"
              stroke={COLORS[index % COLORS.length].stroke}
              fill={COLORS[index % COLORS.length].fill}
              fillOpacity={0.3}
            />
          ))}

          <Legend wrapperStyle={{ color: textColor }} />
          <Tooltip 
            contentStyle={{ backgroundColor: tooltipBg, borderRadius: '8px', border: `1px solid ${tooltipBorder}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: tooltipText }}
            itemStyle={{ fontSize: '14px', fontWeight: 500 }}
            labelStyle={{ color: tooltipText }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComparisonChart;
