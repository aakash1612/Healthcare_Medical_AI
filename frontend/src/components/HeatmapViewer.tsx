import React, { useState } from 'react';
import { GradCAMResult } from '../types';
import clsx from 'clsx';
import { Layers, Image as ImageIcon, ScanLine } from 'lucide-react';

type ViewMode = 'original' | 'heatmap' | 'overlay';

interface HeatmapViewerProps {
  originalUrl: string;
  gradcam: GradCAMResult;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({ originalUrl, gradcam }) => {
  const [mode, setMode] = useState<ViewMode>('overlay');

  const imgSrc =
    mode === 'original'
      ? originalUrl
      : mode === 'heatmap'
        ? `data:image/png;base64,${gradcam.heatmapBase64}`
        : `data:image/png;base64,${gradcam.overlayBase64}`;

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'original', label: 'Original', icon: <ImageIcon size={13} /> },
    { id: 'heatmap', label: 'Heat Map', icon: <ScanLine size={13} /> },
    { id: 'overlay', label: 'Overlay', icon: <Layers size={13} /> },
  ];

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-bg-base rounded-lg border border-bg-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-mono transition-all',
              mode === tab.id
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Image display */}
      <div className="relative rounded-xl overflow-hidden bg-black border border-bg-border scan-line">
        <img
          src={imgSrc}
          alt={`Medical scan — ${mode} view`}
          className="w-full h-auto object-contain max-h-80 transition-all duration-300"
        />

        {/* Heatmap legend */}
        {mode !== 'original' && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2 glass rounded-lg px-3 py-2">
            <div className="h-2 w-20 rounded-full"
              style={{ background: 'linear-gradient(to right, #00008b, #0000ff, #00ffff, #ffff00, #ff0000)' }}
            />
            <div className="flex justify-between w-20 absolute bottom-4 right-3">
              <span className="font-mono text-[9px] text-slate-400">Low</span>
              <span className="font-mono text-[9px] text-slate-400">High</span>
            </div>
          </div>
        )}
      </div>

      {/* Top activation regions */}
      {mode !== 'original' && gradcam.topRegions.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
            High-Activation Regions
          </p>
          {gradcam.topRegions.map((region, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-bg-border">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-accent-amber/10 text-accent-amber font-mono text-xs">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-body text-xs text-slate-300">{region.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-amber to-accent-red"
                    style={{ width: `${region.intensity * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-slate-500 w-10 text-right">
                  {(region.intensity * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
