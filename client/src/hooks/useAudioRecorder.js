import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useAudioRecorder hook
 * Manages the microphone stream and recording lifecycle.
 * Version 7.0: Senior Web Media Hardware Decoupling.
 */
export function useAudioRecorder() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'processing' | 'ready'
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [stream, setStream] = useState(null); // State for UI visuals only
  const [error, setError] = useState(null);
  
  const streamRef = useRef(null); // Ref for strict hardware control
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimeoutRef = useRef(null);

  const clearAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }
    setStatus('idle');
  }, [audioUrl]);

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
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac'
      ];
      
      let mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
      console.log(`[Recorder] Selected MIME: ${mimeType}`);

      const options = { mimeType };
      const mediaRecorder = new MediaRecorder(newStream, options);
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
        
        // 2. Commit Blobs
        const finalType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(finalChunks, { type: finalType });
        const url = URL.createObjectURL(blob);
        
        setAudioUrl(url);
        setAudioBlob(blob);
        
        // 3. Hardware Release
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setStream(null);
        chunksRef.current = [];

        // 4. Signal Ready (Absolute final line)
        setStatus('ready');
      };

      clearAudio();
      mediaRecorder.start(500);
      setStatus('recording');
    } catch (err) {
      console.error("[Recorder] Start Error:", err);
      setError(err.message || "Could not access microphone.");
      setStatus('idle');
      setStream(null);
      throw err;
    }
  }, [clearAudio]); 

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setStatus('processing');
      
      // Safety timeout for onstop event (3 seconds)
      stopTimeoutRef.current = setTimeout(() => {
        if (status === 'processing') {
          console.error("[Recorder] onstop timeout. Force reset.");
          setStatus('idle');
          setError("Recording failed to finalize. Check mic and try again.");
        }
      }, 3000);

      mediaRecorderRef.current.stop();
    }
  }, [status]);

  // Cleanup effect: Strictly hardware-focused, decoupled from render cycle
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      // Only stop if the ref actually holds a stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []); // Absolute hardware control

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
