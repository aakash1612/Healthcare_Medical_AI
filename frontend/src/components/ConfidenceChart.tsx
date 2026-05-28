import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CNNPrediction } from '../types';

interface ConfidenceChartProps {
  prediction: CNNPrediction;
}

export const ConfidenceChart: React.FC<ConfidenceChartProps> = ({ prediction }) => {
  const data = Object.entries(prediction.classScores).map(([name, score]) => ({
    name,
    score: Math.round(score * 100),
    isPredicted: name === prediction.predictedClass,
  }));

  return (
    <div className="space-y-4">
      {/* Main prediction display */}
      <div className="p-4 rounded-xl border border-bg-border bg-bg-elevated">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-1">
              Primary Finding
            </p>
            <p className="font-display text-xl font-bold text-white">
              {prediction.predictedClass}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-slate-500 mb-1">Confidence</p>
            <p className={`font-display text-2xl font-bold ${
              prediction.confidence > 0.85 ? 'text-accent-teal' :
              prediction.confidence > 0.7 ? 'text-accent-amber' : 'text-accent-red'
            }`}>
              {(prediction.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-1.5 rounded-full bg-bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${prediction.confidence * 100}%`,
              background: prediction.confidence > 0.85
                ? 'linear-gradient(to right, #00b896, #00d4ff)'
                : prediction.confidence > 0.7
                  ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                  : 'linear-gradient(to right, #ef4444, #991b1b)',
            }}
          />
        </div>
      </div>

      {/* Class probability chart */}
      <div>
        <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-3">
          Class Probabilities
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(val: number) => [`${val}%`, 'Probability']}
              contentStyle={{
                background: '#0d1a26',
                border: '1px solid #1a3348',
                borderRadius: '8px',
                fontFamily: 'JetBrains Mono',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isPredicted ? '#00d4ff' : '#1a3348'}
                  opacity={entry.isPredicted ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
