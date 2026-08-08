import { useCallback, useEffect, useRef, useState } from "react";

type UseChatScreenShareArgs = {
  pc: RTCPeerConnection | null;
  enabled: boolean;
  onRenegotiate?: () => void;
};

export function useChatScreenShare({ pc, enabled, onRenegotiate }: UseChatScreenShareArgs) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const stopPresent = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setPresenting(false);
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        void sender.replaceTrack(null);
      }
    }
  }, [pc]);

  const startPresent = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      track.onended = () => stopPresent();
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setPresenting(true);

      if (pc) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
        onRenegotiate?.();
      }
    } catch {
      setError("Screen share permission denied");
    }
  }, [enabled, pc, onRenegotiate, stopPresent]);

  useEffect(() => {
    if (!enabled) stopPresent();
  }, [enabled, stopPresent]);

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { screenStream, presenting, error, startPresent, stopPresent };
}
