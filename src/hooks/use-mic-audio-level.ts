import { useEffect, useRef, useState } from "react";

const SPEAK_THRESHOLD = 0.06;

export function useMicAudioLevel(
  stream: MediaStream | null,
  active: boolean,
): { level: number; speaking: boolean } {
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      setSpeaking(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack?.enabled) {
      setLevel(0);
      setSpeaking(false);
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      const normalized = sum / data.length / 255;
      smoothed = smoothed * 0.65 + normalized * 0.35;
      setLevel(smoothed);
      setSpeaking(smoothed > SPEAK_THRESHOLD);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
    };
  }, [stream, active]);

  return { level, speaking };
}
