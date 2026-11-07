/**
 * hooks/useVisionPresence.js — In-Browser Computer Vision Presence Tracker
 * 
 * Uses Google MediaPipe FaceLandmarker for zero-latency, private, client-side
 * visual presence tracking (eye contact, posture, head stability, and expressions).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export function useVisionPresence() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [liveEyeContact, setLiveEyeContact] = useState(false);
  const [visualSummary, setVisualSummary] = useState(null);

  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const samplesRef = useRef([]);
  const isTrackingRef = useRef(false);
  const lastHeadPosRef = useRef(null);
  const fidgetCountRef = useRef(0);

  // 1. Initialize MediaPipe FaceLandmarker
  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setIsModelLoading(true);
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
      landmarkerRef.current = faceLandmarker;
      setIsModelLoading(false);
      return faceLandmarker;
    } catch (err) {
      console.warn("[Vision] MediaPipe initialization error (falling back to lightweight tracking):", err);
      setIsModelLoading(false);
      return null;
    }
  }, []);

  // 2. Start Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      initLandmarker();
    } catch (err) {
      console.error("[Vision] Camera access denied or unavailable:", err);
      setIsCameraActive(false);
    }
  }, [initLandmarker]);

  // 3. Stop Camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsCameraActive(false);
    setFaceDetected(false);
    setLiveEyeContact(false);
  }, []);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isCameraActive, startCamera, stopCamera]);

  // 4. Start Tracking (called when speech recording starts)
  const startTracking = useCallback(() => {
    samplesRef.current = [];
    fidgetCountRef.current = 0;
    lastHeadPosRef.current = null;
    setVisualSummary(null);
    isTrackingRef.current = true;
  }, []);

  // 5. Vision Sampling Loop (runs while video is playing)
  useEffect(() => {
    let lastSampleTime = 0;

    const detectFrame = (now) => {
      if (!videoRef.current || !isCameraActive || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      // Sample every 150ms for performance (~7 FPS is plenty for presence metrics)
      if (now - lastSampleTime >= 150 && landmarkerRef.current) {
        lastSampleTime = now;
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, now);
          const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
          setFaceDetected(hasFace);

          if (hasFace) {
            const landmarks = results.faceLandmarks[0];
            const noseTip = landmarks[1]; // Center of face
            const forehead = landmarks[10];
            const chin = landmarks[152];
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];

            // A. Posture & Head Angle Calculation
            // Yaw: difference in horizontal distance from nose to left vs right eye
            const leftDist = Math.abs(noseTip.x - leftEye.x);
            const rightDist = Math.abs(noseTip.x - rightEye.x);
            const yawOffset = Math.abs(leftDist - rightDist) / (leftDist + rightDist || 1);

            // Pitch: vertical face height
            const faceHeight = Math.abs(chin.y - forehead.y);
            const noseRelY = (noseTip.y - forehead.y) / (faceHeight || 1);
            const isLookingDown = noseRelY > 0.65; // looking down at desk/keyboard
            const isLookingUp = noseRelY < 0.40;

            // Eye contact rule: head is reasonably centered horizontally & vertically
            const isLookingAtCamera = yawOffset < 0.35 && !isLookingDown && !isLookingUp;
            setLiveEyeContact(isLookingAtCamera);

            // B. Expression (Blendshapes)
            let smileScore = 0;
            if (results.faceBlendshapes && results.faceBlendshapes[0]) {
              const categories = results.faceBlendshapes[0].categories;
              const smileL = categories.find(c => c.categoryName === 'mouthSmileLeft')?.score || 0;
              const smileR = categories.find(c => c.categoryName === 'mouthSmileRight')?.score || 0;
              smileScore = (smileL + smileR) / 2;
            }

            // C. Fidget / Head Stability Detection
            if (lastHeadPosRef.current) {
              const dx = Math.abs(noseTip.x - lastHeadPosRef.current.x);
              const dy = Math.abs(noseTip.y - lastHeadPosRef.current.y);
              if (dx > 0.08 || dy > 0.08) {
                fidgetCountRef.current += 1;
              }
            }
            lastHeadPosRef.current = { x: noseTip.x, y: noseTip.y };

            // Posture: Is face vertically in comfortable frame (0.25 to 0.65 of viewport)?
            const isGoodPosture = noseTip.y >= 0.20 && noseTip.y <= 0.65;

            // Record sample if recording is actively tracking
            if (isTrackingRef.current) {
              samplesRef.current.push({
                isLookingAtCamera,
                isGoodPosture,
                isSmiling: smileScore > 0.22,
                facePresent: true,
              });
            }
          } else {
            setLiveEyeContact(false);
            if (isTrackingRef.current) {
              samplesRef.current.push({
                isLookingAtCamera: false,
                isGoodPosture: false,
                isSmiling: false,
                facePresent: false,
              });
            }
          }
        } catch (e) {
          // Frame skip
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive]);

  // 6. Stop Tracking & Generate Visual Presence Summary
  const stopTracking = useCallback(() => {
    isTrackingRef.current = false;
    const samples = samplesRef.current;
    if (!isCameraActive || samples.length === 0) {
      setVisualSummary(null);
      return null;
    }

    const faceSamples = samples.filter(s => s.facePresent);
    if (faceSamples.length === 0) {
      const summary = {
        enabled: true,
        eyeContactPercent: 0,
        eyeContactRating: "No Face Detected",
        posture: "Out of Camera View",
        headStability: "Unknown",
        expressiveness: "Neutral",
        smilesDetected: 0,
        fidgetAlerts: 0,
        presenceScore: 2,
      };
      setVisualSummary(summary);
      return summary;
    }

    const eyeContactCount = faceSamples.filter(s => s.isLookingAtCamera).length;
    const eyeContactPercent = Math.round((eyeContactCount / faceSamples.length) * 100);

    const goodPostureCount = faceSamples.filter(s => s.isGoodPosture).length;
    const posturePercent = Math.round((goodPostureCount / faceSamples.length) * 100);

    const smileCount = faceSamples.filter(s => s.isSmiling).length;
    const fidgetAlerts = fidgetCountRef.current;

    let eyeContactRating = "Strong";
    if (eyeContactPercent < 55) eyeContactRating = "Needs Work (Frequent Lookaway)";
    else if (eyeContactPercent < 75) eyeContactRating = "Moderate";

    let posture = "Upright & Centered";
    if (posturePercent < 60) posture = "Slouched / Low in Frame";

    let headStability = "Calm & Composed";
    if (fidgetAlerts >= 5) headStability = "Frequent Head Movement / Fidgeting";

    let expressiveness = "Composed & Professional";
    if (smileCount > (faceSamples.length * 0.15)) expressiveness = "Warm & Engaging";

    // Presence Score calculation (1-10)
    let score = 10;
    if (eyeContactPercent < 50) score -= 3;
    else if (eyeContactPercent < 70) score -= 1.5;

    if (posturePercent < 60) score -= 2;
    if (fidgetAlerts >= 5) score -= 2;
    score = Math.max(1, Math.min(10, Math.round(score)));

    const summary = {
      enabled: true,
      eyeContactPercent,
      eyeContactRating,
      posture,
      headStability,
      expressiveness,
      smilesDetected: Math.min(10, Math.round(smileCount / 5)),
      fidgetAlerts,
      presenceScore: score,
    };

    setVisualSummary(summary);
    return summary;
  }, [isCameraActive]);

  return {
    isCameraActive,
    isModelLoading,
    faceDetected,
    liveEyeContact,
    visualSummary,
    videoRef,
    toggleCamera,
    startCamera,
    stopCamera,
    startTracking,
    stopTracking,
  };
}
