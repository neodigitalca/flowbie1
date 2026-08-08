import { useEffect, useRef, useState } from "react";
import { fetchChatCallTranscript, postFloCallTranscribe } from "@/lib/chat-call-api";
import type { ChatCallTranscriptLine } from "@/lib/chat-call-types";

type UseChatFloCallTranscriptionArgs = {
  teamId: number | null;
  callId: number | null;
  active: boolean;
  muted: boolean;
  displayName: string;
  callStartMs: number;
  floCall: boolean;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("read failed"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export function useChatFloCallTranscription({
  teamId,
  callId,
  active,
  muted,
  displayName,
  callStartMs,
  floCall,
}: UseChatFloCallTranscriptionArgs): {
  lines: ChatCallTranscriptLine[];
  micError: string | null;
  transcribeError: string | null;
  listening: boolean;
  setMuted: (next: boolean) => void;
} {
  const [lines, setLines] = useState<ChatCallTranscriptLine[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const busyRef = useRef(false);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    if (recorderRef.current) {
      setListening(!muted);
    }
  }, [muted]);

  const setMutedState = (next: boolean) => {
    mutedRef.current = next;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setListening(!next && recorderRef.current != null);
  };

  useEffect(() => {
    if (!floCall || !teamId || !callId || !active) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setMicError(null);
      setListening(false);
      return;
    }

    let cancelled = false;

    const loadTranscript = async () => {
      const transcript = await fetchChatCallTranscript(teamId, callId);
      if (!cancelled) setLines(transcript);
    };

    void loadTranscript();
    const pollId = window.setInterval(() => void loadTranscript(), 2000);

    const start = async () => {
      setMicError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !mutedRef.current;
        });
        streamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        recorderRef.current = recorder;
        setListening(!mutedRef.current);

        recorder.ondataavailable = (ev) => {
          if (!ev.data.size || mutedRef.current || busyRef.current || !teamId || !callId) return;
          busyRef.current = true;
          const spokenAtMs = Math.max(0, Date.now() - callStartMs);
          void blobToBase64(ev.data)
            .then((dataBase64) =>
              postFloCallTranscribe(teamId, callId, {
                dataBase64,
                format: mime.includes("webm") ? "webm" : "mp4",
                displayName,
                spokenAtMs,
              }),
            )
            .then((result) => {
              if (!result.ok) {
                if (result.code !== "no_speech") {
                  setTranscribeError(result.error ?? "Transcription failed");
                }
                return;
              }
              setTranscribeError(null);
              void fetchChatCallTranscript(teamId, callId).then(setLines);
            })
            .finally(() => {
              busyRef.current = false;
            });
        };

        recorder.start(3500);
      } catch {
        setMicError("Microphone access denied");
        setListening(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setListening(false);
    };
  }, [teamId, callId, active, displayName, callStartMs, floCall]);

  return { lines, micError, transcribeError, listening, setMuted: setMutedState };
}
