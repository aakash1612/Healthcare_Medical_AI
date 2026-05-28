import React, { useState } from 'react';
import { AnalysisReport } from '../types';
import { FileText, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface ClinicalReportProps {
  report: AnalysisReport;
}

export const ClinicalReport: React.FC<ClinicalReportProps> = ({ report }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Summary */}
      <div className="p-4 rounded-xl border border-accent-teal/20 bg-accent-teal/5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={14} className="text-accent-teal" />
          <span className="font-mono text-xs text-accent-teal uppercase tracking-widest">
            AI Summary
          </span>
        </div>
        <p className="font-body text-sm text-slate-300 leading-relaxed">{report.summary}</p>
      </div>

      {/* Findings */}
      <Section title="Key Findings" accent="cyan">
        <ul className="space-y-2">
          {report.findings.map((finding, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-cyan flex-shrink-0" />
              <span className="font-body text-sm text-slate-300">{finding}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Differential Diagnosis */}
      {report.differentialDiagnosis.length > 0 && (
        <Section title="Differential Diagnosis" accent="amber">
          <div className="flex flex-wrap gap-2">
            {report.differentialDiagnosis.map((d, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-mono border border-accent-amber/20
                           bg-accent-amber/8 text-accent-amber"
              >
                {d}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Recommendations */}
      <Section title="Recommendations" accent="teal">
        <ul className="space-y-2">
          {report.recommendations.map((rec, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="font-mono text-xs text-accent-teal mt-0.5 flex-shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-body text-sm text-slate-300">{rec}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Confidence Narrative */}
      <div className="p-4 rounded-xl border border-bg-border bg-bg-elevated">
        <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">
          Confidence Analysis
        </p>
        <p className="font-body text-sm text-slate-400 leading-relaxed italic">
          {report.confidenceNarrative}
        </p>
      </div>

      {/* Sources */}
      {report.retrievedSources.length > 0 && (
        <div className="rounded-xl border border-bg-border overflow-hidden">
          <button
            onClick={() => setSourcesOpen(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-bg-elevated transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink size={13} className="text-slate-400" />
              <span className="font-mono text-xs text-slate-400">
                {report.retrievedSources.length} Medical Sources Retrieved
              </span>
            </div>
            {sourcesOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </button>

          {sourcesOpen && (
            <div className="border-t border-bg-border divide-y divide-bg-border">
              {report.retrievedSources.map((source, i) => (
                <div key={i} className="p-4 bg-bg-base">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="font-mono text-xs text-accent-cyan">{source.source}</p>
                    <span className="font-mono text-xs text-slate-600 flex-shrink-0">
                      {(source.relevanceScore * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="font-body text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {source.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex gap-3 p-4 rounded-xl border border-accent-amber/20 bg-accent-amber/5">
        <AlertTriangle size={16} className="text-accent-amber flex-shrink-0 mt-0.5" />
        <p className="font-body text-xs text-slate-400 leading-relaxed">{report.disclaimer}</p>
      </div>
    </div>
  );
};

function Section({
  title, accent, children,
}: {
  title: string;
  accent: 'cyan' | 'teal' | 'amber';
  children: React.ReactNode;
}) {
  const colors = {
    cyan: 'text-accent-cyan',
    teal: 'text-accent-teal',
    amber: 'text-accent-amber',
  };

  return (
    <div>
      <p className={clsx('font-mono text-xs uppercase tracking-widest mb-3', colors[accent])}>
        {title}
      </p>
      {children}
    </div>
  );
}
