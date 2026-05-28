import { useState, useEffect, useCallback, useRef } from 'react';
import { analysisApi } from '../services/api';
import { getSocket, joinSession, sendChatMessage } from '../services/socket';
import {
  AnalysisResult, AnalysisStatus, ProgressPayload, ChatMessage,
} from '../types';

export function useAnalysis() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pipelineStatus, setPipelineStatus] = useState<AnalysisStatus | null>(null);
  const [pipelineMessage, setPipelineMessage] = useState('');
  const [pipelinePercent, setPipelinePercent] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const sessionIdRef = useRef<string | null>(null);

  // 🌟 Centralized, Permanent Global Listener Matrix
  useEffect(() => {
    const socket = getSocket();

    // 🔄 Connection Recovery Handler: If the socket drops or cycles mid-pipeline,
    // immediately re-bind to our active background room session.
    socket.on('connect', () => {
      console.log('[Socket State] Signal link stabilized:', socket.id);
      if (sessionIdRef.current) {
        console.log('[Socket Recovery] Re-registering room listener for session:', sessionIdRef.current);
        joinSession(sessionIdRef.current);
      }
    });

    socket.on('analysis:progress', (payload: ProgressPayload) => {
      console.log('[Socket Event] Progress Raw Frame:', payload);
      
      // 🧩 Auto-Join fallback safety mechanism
      if (!sessionIdRef.current && payload.sessionId) {
        console.log('[Socket Matrix] Dynamic Room Registration for:', payload.sessionId);
        sessionIdRef.current = payload.sessionId;
        joinSession(payload.sessionId);
      }

      setPipelineStatus(payload.status);
      setPipelineMessage(payload.message);
      setPipelinePercent(payload.percentComplete || (payload as any).percent || 0);
    });

    socket.on('analysis:complete', (data: AnalysisResult) => {
      console.log('[Socket Event] Pipeline Complete Payload:', data);
      setResult(data);
      setIsLoading(false);
      setPipelinePercent(100);
    });

    socket.on('analysis:error', ({ error: err }: { error: string }) => {
      setError(err);
      setIsLoading(false);
    });

    socket.on('chat:thinking', () => setIsChatLoading(true));

    socket.on('chat:response', ({ answer, sources }: { answer: string; sources: unknown[] }) => {
      setChatMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          sources: sources as ChatMessage['sources'],
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsChatLoading(false);
    });

    socket.on('chat:error', () => setIsChatLoading(false));

    return () => {
      socket.off('connect');
      socket.off('analysis:progress');
      socket.off('analysis:complete');
      socket.off('analysis:error');
      socket.off('chat:thinking');
      socket.off('chat:response');
      socket.off('chat:error');
    };
  }, []);

  const startAnalysisWithSession = useCallback(async (file: File, modelId: string) => {
    reset();
    setIsLoading(true);

    try {
      // Establish layout baselines cleanly before pipeline triggers
      setPipelineStatus('queued');
      setPipelineMessage('Preparing payloads and initializing stream link...');
      setPipelinePercent(3);

      // Execute upload directly. The global listener matrix above handles the data binding intercept!
      const response = await analysisApi.upload(file, modelId, setUploadProgress);
      if (!response.success || !response.data) throw new Error(response.error || 'Upload failed');
      
      // ✅ FIXED: Using type casting bypass to handle the newly returned session ID property cleanly
      const uploadData = response.data as any;
      if (uploadData && uploadData.sessionId) {
        console.log('[HTTP Response] Pre-allocated session token locked:', uploadData.sessionId);
        sessionIdRef.current = uploadData.sessionId;
        joinSession(uploadData.sessionId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback((question: string) => {
    if (!sessionIdRef.current && !result?.sessionId) return;
    const sessionId = sessionIdRef.current || result?.sessionId || '';

    setChatMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      },
    ]);

    sendChatMessage(sessionId, question);
  }, [result?.sessionId]);

  function reset() {
    setUploadProgress(0);
    setPipelineStatus(null);
    setPipelineMessage('');
    setPipelinePercent(0);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setChatMessages([]);
    setIsChatLoading(false);
    sessionIdRef.current = null;
  }

  return {
    startAnalysis: startAnalysisWithSession,
    uploadProgress,
    pipelineStatus,
    pipelineMessage,
    pipelinePercent,
    result,
    error,
    isLoading,
    chatMessages,
    sendMessage,
    isChatLoading,
    reset,
  };
}