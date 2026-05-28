import React from 'react';
import { AnalysisStatus } from '../types';
import clsx from 'clsx';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

const STAGES: { status: AnalysisStatus; label: string; description: string }[] = [
  { status: 'running_cnn', label: 'CNN Classification', description: 'ResNet analyzing image patterns' },
  { status: 'generating_heatmap', label: 'Grad-CAM Heatmap', description: 'Mapping activation regions' },
  { status: 'retrieving_knowledge', label: 'RAG Retrieval', description: 'Querying medical literature' },
  { status: 'generating_report', label: 'LLM Report', description: 'Synthesizing clinical findings' },
];

const STATUS_ORDER: AnalysisStatus[] = [
  'queued', 'preprocessing', 'running_cnn', 'generating_heatmap',
  'retrieving_knowledge', 'generating_report', 'complete', 'error',
];

function getStageState(stageStatus: AnalysisStatus, currentStatus: AnalysisStatus) {
  if (currentStatus === 'error') return 'error';
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stageIdx = STATUS_ORDER.indexOf(stageStatus);
  if (stageIdx < currentIdx) return 'done';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
}

interface PipelineProgressProps {
  status: AnalysisStatus;
  message: string;
  percent: number;
}

export const PipelineProgress: React.FC<PipelineProgressProps> = ({ status, message, percent }) => {
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-xs text-accent-cyan">{message}</span>
          <span className="font-mono text-xs text-slate-500">{percent}%</span>
        </div>
        <div className="h-1 bg-bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-teal to-accent-cyan rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const state = getStageState(stage.status, status);
          return (
            <div key={stage.status} className="flex items-center gap-4">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                {state === 'done' && <CheckCircle2 size={18} className="text-accent-teal flex-shrink-0" />}
                {state === 'active' && <Loader2 size={18} className="text-accent-cyan flex-shrink-0 animate-spin" />}
                {state === 'pending' && <Circle size={18} className="text-slate-700 flex-shrink-0" />}
                {state === 'error' && <XCircle size={18} className="text-accent-red flex-shrink-0" />}
                {i < STAGES.length - 1 && (
                  <div className={clsx(
                    'w-px h-6 mt-1',
                    state === 'done' ? 'bg-accent-teal/40' : 'bg-bg-border'
                  )} />
                )}
              </div>

              <div className={clsx(
                'flex-1 transition-opacity',
                state === 'pending' ? 'opacity-30' : 'opacity-100'
              )}>
                <p className={clsx(
                  'font-body text-sm font-medium',
                  state === 'active' ? 'text-accent-cyan' :
                  state === 'done' ? 'text-accent-teal' : 'text-slate-400'
                )}>
                  {stage.label}
                </p>
                <p className="font-mono text-xs text-slate-600">{stage.description}</p>
              </div>

              {state === 'active' && (
                <div className="flex gap-1">
                  {[0, 1, 2].map(j => (
                    <div
                      key={j}
                      className="w-1 h-1 rounded-full bg-accent-cyan animate-pulse"
                      style={{ animationDelay: `${j * 200}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
