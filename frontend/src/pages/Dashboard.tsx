import React, { useEffect, useState } from 'react';
import { UploadZone } from '../components/UploadZone';
import { ModelSelector } from '../components/ModelSelector';
import { PipelineProgress } from '../components/PipelineProgress';
import { HeatmapViewer } from '../components/HeatmapViewer';
import { ConfidenceChart } from '../components/ConfidenceChart';
import { ClinicalReport } from '../components/ClinicalReport';
import { ChatPanel } from '../components/ChatPanel';
import { useAnalysis } from '../hooks/useAnalysis';
import { modelsApi } from '../services/api';
import { ModelDefinition } from '../types';
import { Activity, RotateCcw, Clock, Cpu } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    startAnalysis, uploadProgress,
    pipelineStatus, pipelineMessage, pipelinePercent,
    result, error, isLoading,
    chatMessages, sendMessage, isChatLoading,
    reset,
  } = useAnalysis();

  // Fetch model registry
  useEffect(() => {
    modelsApi.getAll()
      .then(res => {
        if (res.data) {
          setModels(res.data);
          const firstActive = res.data.find(m => m.isActive);
          if (firstActive) setSelectedModelId(firstActive.id);
        }
      })
      .catch(() => {
        // Fallback: show placeholder models for UI dev
        setModels([{
          id: 'xray-pneumonia-v1', name: 'Chest X-Ray — Pneumonia Detector',
          modality: 'xray', version: '1.0.0',
          classes: ['Normal', 'Pneumonia'],
          description: 'ResNet-50 trained on the Kaggle Chest X-Ray dataset.',
          gradcamEnabled: true, isActive: true,
        }]);
        setSelectedModelId('xray-pneumonia-v1');
      });
  }, []);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRun = async () => {
    if (!selectedFile || !selectedModelId) return;
    await startAnalysis(selectedFile, selectedModelId);
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const canRun = !!selectedFile && !!selectedModelId && !isLoading;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top bar */}
      <header className="border-b border-bg-border bg-bg-surface">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20
                            flex items-center justify-center">
              <Activity size={16} className="text-accent-cyan" />
            </div>
            <div>
              <span className="font-display text-sm font-bold text-white tracking-tight">MedAI</span>
              <span className="font-mono text-xs text-slate-500 ml-2">Explainable Medical AI</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {result && (
              <div className="flex items-center gap-2 text-slate-500">
                <Clock size={13} />
                <span className="font-mono text-xs">
                  {(result.processingTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-teal animate-pulse-slow" />
              <span className="font-mono text-xs text-slate-500">System online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6 grid grid-cols-12 gap-6 h-[calc(100vh-3.5rem)]">

        {/* ── Left Panel: Upload + Model Select ── */}
        <div className="col-span-3 flex flex-col gap-5 overflow-y-auto">
          <Panel label="01 / Upload Scan">
            <UploadZone onFileSelected={handleFileSelected} disabled={isLoading} />
            {previewUrl && !isLoading && !result && (
              <div className="mt-3 rounded-xl overflow-hidden border border-bg-border">
                <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover" />
              </div>
            )}
          </Panel>

          <Panel label="02 / Select Model">
            <ModelSelector
              models={models}
              selectedId={selectedModelId}
              onSelect={setSelectedModelId}
              disabled={isLoading}
            />
          </Panel>

          {/* Run / Reset */}
          <div className="flex gap-3">
            {result ? (
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-bg-border text-slate-400 hover:text-white
                           hover:border-slate-500 transition-all font-body text-sm"
              >
                <RotateCcw size={14} />
                New Analysis
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={!canRun}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                           bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan
                           hover:bg-accent-cyan/25 transition-all font-body font-medium text-sm
                           disabled:opacity-30 disabled:cursor-not-allowed glow-cyan"
              >
                <Cpu size={14} />
                {isLoading ? `Uploading ${uploadProgress}%…` : 'Run Analysis'}
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl border border-accent-red/30 bg-accent-red/5">
              <p className="font-mono text-xs text-accent-red">{error}</p>
            </div>
          )}
        </div>

        {/* ── Centre Panel: Progress → Image + Heatmap + Prediction ── */}
        <div className="col-span-5 flex flex-col gap-5 overflow-y-auto">
          {isLoading && pipelineStatus && (
            <Panel label="Pipeline">
              <PipelineProgress
                status={pipelineStatus}
                message={pipelineMessage}
                percent={pipelinePercent}
              />
            </Panel>
          )}

          {result && (
            <>
              <Panel label="03 / Scan + Grad-CAM Heatmap">
                <HeatmapViewer
                  originalUrl={result.originalImageUrl}
                  gradcam={result.gradcam}
                />
              </Panel>

              <Panel label="04 / CNN Prediction">
                <ConfidenceChart prediction={result.prediction} />
              </Panel>
            </>
          )}

          {!isLoading && !result && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl border border-bg-border bg-bg-elevated
                                flex items-center justify-center mx-auto">
                  <Activity size={28} className="text-slate-700" />
                </div>
                <p className="font-body text-sm text-slate-600">
                  Upload a scan and run analysis to see results
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Report + Chat ── */}
        <div className="col-span-4 flex flex-col gap-5 overflow-hidden">
          {result && (
            <Panel label="05 / Clinical Report" className="overflow-y-auto max-h-[50%]">
              <ClinicalReport report={result.report} />
            </Panel>
          )}

          <Panel label="06 / Clinical Q&A" className="flex-1 flex flex-col min-h-0">
            <ChatPanel
              messages={chatMessages}
              onSend={sendMessage}
              isLoading={isChatLoading}
              disabled={!result}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
};

function Panel({
  label, children, className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-5 flex flex-col gap-4 ${className}`}>
      <p className="font-mono text-[10px] text-slate-600 uppercase tracking-[0.2em]">{label}</p>
      {children}
    </div>
  );
}
