/**
 * lib/deliveryMetrics.js — Speech Prosody, Pace (WPM) & Pause Analytics
 * 
 * Extracts temporal delivery insights from Whisper verbose_json segments:
 * - Words Per Minute (WPM)
 * - Pacing classification (Optimal, Deliberate, Rushed, Slow)
 * - Awkward pauses & freeze detection (silences >= 2.0s)
 * - Active speech vs dead air ratio
 */

export function calculateDeliveryMetrics(transcriptionVerbose) {
  const text = (transcriptionVerbose?.text || '').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const rawDuration = transcriptionVerbose?.duration || 0;
  const durationSec = Number(rawDuration.toFixed(1));
  const segments = transcriptionVerbose?.segments || [];

  let activeSpeakingSec = 0;
  const awkwardPauses = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDur = Math.max(0, (seg.end || 0) - (seg.start || 0));
    activeSpeakingSec += segDur;

    if (i < segments.length - 1) {
      const nextSeg = segments[i + 1];
      const gap = (nextSeg.start || 0) - (seg.end || 0);
      // Gaps >= 2.0 seconds represent hesitation freezes or dead air
      if (gap >= 2.0) {
        const mins = Math.floor(seg.end / 60);
        const secs = Math.floor(seg.end % 60);
        awkwardPauses.push({
          timestamp: `${mins}:${secs.toString().padStart(2, '0')}`,
          startSec: Number(seg.end.toFixed(1)),
          durationSec: Number(gap.toFixed(1))
        });
      }
    }
  }

  activeSpeakingSec = Number(activeSpeakingSec.toFixed(1));
  const totalSilenceSec = Number(Math.max(0, durationSec - activeSpeakingSec).toFixed(1));
  const silencePercentage = durationSec > 0 
    ? Math.min(100, Number(((totalSilenceSec / durationSec) * 100).toFixed(0))) 
    : 0;

  // WPM calculation based on total recording duration
  const effectiveMinutes = durationSec > 0 ? durationSec / 60 : 0;
  const wpm = effectiveMinutes > 0 ? Math.round(wordCount / effectiveMinutes) : 0;

  // Pacing Classification
  let pacing = 'Optimal';
  let pacingDesc = 'Conversational & Engaging';
  let badgeColor = 'emerald';

  if (wpm === 0 || wordCount < 3) {
    pacing = 'None';
    pacingDesc = 'No speech detected';
    badgeColor = 'zinc';
  } else if (wpm < 110) {
    pacing = 'Slow';
    pacingDesc = 'Hesitant or Low Momentum';
    badgeColor = 'amber';
  } else if (wpm <= 130) {
    pacing = 'Deliberate';
    pacingDesc = 'Thoughtful & Measured';
    badgeColor = 'blue';
  } else if (wpm <= 165) {
    pacing = 'Optimal';
    pacingDesc = 'Ideal Conversational Speed';
    badgeColor = 'emerald';
  } else if (wpm <= 185) {
    pacing = 'Fast';
    pacingDesc = 'High Energy / Watch Breath';
    badgeColor = 'amber';
  } else {
    pacing = 'Rushed';
    pacingDesc = 'Rushed / Potential Panic';
    badgeColor = 'rose';
  }

  // Delivery / Rhythm Score (1 - 10)
  let pacingScore = 10;
  if (wpm < 100) pacingScore -= 3;
  else if (wpm < 120) pacingScore -= 1;
  else if (wpm > 185) pacingScore -= 3;
  else if (wpm > 165) pacingScore -= 1;

  pacingScore -= Math.min(4, awkwardPauses.length * 1.5);
  pacingScore = Math.max(1, Math.min(10, Math.round(pacingScore)));

  const longestPauseSec = awkwardPauses.reduce((max, p) => Math.max(max, p.durationSec), 0);

  return {
    wordCount,
    durationSec,
    activeSpeakingSec,
    totalSilenceSec,
    silencePercentage,
    wpm,
    pacing,
    pacingDesc,
    pacingScore,
    badgeColor,
    awkwardPausesCount: awkwardPauses.length,
    longestPauseSec,
    awkwardPauses
  };
}

