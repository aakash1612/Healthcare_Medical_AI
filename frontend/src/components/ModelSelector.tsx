import React from 'react';
import { ModelDefinition } from '../types';
import { Brain, Eye, Microscope, Activity } from 'lucide-react';
import clsx from 'clsx';

const MODALITY_ICONS: Record<string, React.ReactNode> = {
  xray: <Activity size={16} />,
  fundus_retina: <Eye size={16} />,
  histopathology: <Microscope size={16} />,
  ct_scan: <Brain size={16} />,
  mri: <Brain size={16} />,
};

const MODALITY_LABELS: Record<string, string> = {
  xray: 'X-Ray',
  fundus_retina: 'Fundus',
  histopathology: 'Histopath',
  ct_scan: 'CT Scan',
  mri: 'MRI',
};

interface ModelSelectorProps {
  models: ModelDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models, selectedId, onSelect, disabled,
}) => {
  return (
    <div className="space-y-2">
      {models.map(model => {
        const isSelected = model.id === selectedId;
        const isActive = model.isActive;

        return (
          <button
            key={model.id}
            onClick={() => isActive && onSelect(model.id)}
            disabled={!isActive || disabled}
            className={clsx(
              'w-full text-left p-4 rounded-xl border transition-all group',
              isSelected
                ? 'border-accent-cyan bg-accent-cyan/8 glow-cyan'
                : isActive
                  ? 'border-bg-border hover:border-accent-cyan/40 hover:bg-bg-elevated'
                  : 'border-bg-border opacity-40 cursor-not-allowed',
            )}
          >
            <div className="flex items-start gap-3">
              {/* Selection indicator */}
              <div className={clsx(
                'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                isSelected
                  ? 'border-accent-cyan bg-accent-cyan'
                  : 'border-slate-600'
              )}>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-bg-base" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono',
                    isSelected ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-bg-elevated text-slate-400'
                  )}>
                    {MODALITY_ICONS[model.modality]}
                    {MODALITY_LABELS[model.modality] || model.modality}
                  </span>
                  {!isActive && (
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                      Coming soon
                    </span>
                  )}
                </div>

                <p className={clsx(
                  'font-body font-medium text-sm',
                  isSelected ? 'text-white' : 'text-slate-300'
                )}>
                  {model.name}
                </p>
                <p className="font-body text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                  {model.description}
                </p>

                <div className="flex gap-3 mt-2">
                  <span className="font-mono text-xs text-slate-600">v{model.version}</span>
                  <span className="font-mono text-xs text-slate-600">
                    {model.classes.join(' · ')}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
