/**
 * AudioVisualizer.jsx — Real-time input level meter.
 * 
 * Uses Web Audio API AnalyserNode to provide visual confirmation of mic activity.
 */

import { useEffect, useRef } from 'react';

export default function AudioVisualizer({ stream, isRecording }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    if (!stream || !isRecording) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    source.connect(analyser);
    
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVol = average / 128; // 0 to 2
      
      // Draw smooth level meter (bars)
      const barCount = 40;
      const barWidth = (width / barCount) * 0.8;
      const barGap = (width / barCount) * 0.2;
      
      for (let i = 0; i < barCount; i++) {
        // Create a wave effect centered on the middle
        const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const barHeight = Math.max(4, normalizedVol * height * (1 - distFromCenter) * (0.5 + Math.random() * 0.5));
        
        const x = i * (barWidth + barGap);
        const y = (height - barHeight) / 2;
        
        // Gradient from violet to emerald
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#10b981');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 4);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream, isRecording]);

  return (
    <div className="w-full h-16 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden flex items-center justify-center px-4">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={64} 
        className="w-full h-full opacity-80"
      />
    </div>
  );
}
