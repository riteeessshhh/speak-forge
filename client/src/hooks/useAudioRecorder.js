import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useAudioRecorder hook
 * Manages the microphone stream and recording lifecycle.
 * Version 7.1: Cross-Browser Mobile Safe MIME Negotiation + Stale Closure Hardening.
 */
export function useAudioRecorder() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'processing' | 'ready'
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [stream, setStream] = useState(null); // State for UI visuals only
  const [error, setError] = useState(null);
  
  const statusRef = useRef('idle');
  const streamRef = useRef(null); // Ref for strict hardware control
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimeoutRef = useRef(null);

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }
    updateStatus('idle');
  }, [audioUrl, updateStatus]);

  const startRecording = useCallback(async () => {
    console.log("[Recorder] startRecording hook entry");
    try {
      setError(null);
      chunksRef.current = []; 

      // Hardware Acquisition
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Hardware Decoupling: Ref holds the live stream, State drives the UI
      streamRef.current = newStream;
      setStream(newStream);

      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/aac'
      ];
      
      const supportedMime = typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
        ? types.find(t => MediaRecorder.isTypeSupported(t))
        : null;
      console.log(`[Recorder] Selected MIME: ${supportedMime || '(browser default)'}`);

      const mediaRecorder = supportedMime
        ? new MediaRecorder(newStream, { mimeType: supportedMime })
        : new MediaRecorder(newStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
        
        // 1. Final Flush Logic: Capture chunks immediately
        const finalChunks = [...chunksRef.current];
        const finalType = mediaRecorder.mimeType || supportedMime || 'audio/webm';
        const blob = new Blob(finalChunks, { type: finalType });
        
        // 2. Hardware Release
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setStream(null);
        chunksRef.current = [];

        if (!blob || blob.size < 100) {
          console.warn("[Recorder] Empty audio blob captured:", blob?.size);
          setAudioUrl(null);
          setAudioBlob(null);
          setError("No audio captured. Check microphone permissions and try speaking longer.");
          updateStatus('idle');
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);

        // 3. Signal Ready (Absolute final line)
        updateStatus('ready');
      };

      clearAudio();
      mediaRecorder.start(500);
      updateStatus('recording');
    } catch (err) {
      console.error("[Recorder] Start Error:", err);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setError(err.message || "Could not access microphone.");
      updateStatus('idle');
      setStream(null);
      throw err;
    }
  }, [clearAudio, updateStatus]); 

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      updateStatus('processing');
      
      // Safety timeout for onstop event (3 seconds)
      stopTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === 'processing') {
          console.error("[Recorder] onstop timeout. Force reset.");
          updateStatus('idle');
          setError("Recording failed to finalize. Check mic and try again.");
        }
      }, 3000);

      mediaRecorderRef.current.stop();
    }
  }, [updateStatus]);

  // Cleanup effect: Strictly hardware-focused, decoupled from render cycle
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { 
    status,
    isRecording: status === 'recording',
    audioUrl, 
    audioBlob,
    stream,
    error,
    startRecording, 
    stopRecording, 
    clearAudio 
  };
}
