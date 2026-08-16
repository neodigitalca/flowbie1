import React, { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NeoPulseAvatar } from "@/components/chat/NeoPulseAvatar";
import { ChatVideoTile } from "@/components/chat/calls/ChatVideoTile";
import type { ChatCallPhase, ChatCallTranscriptLine } from "@/lib/chat-call-types";
import { NEO_PULSE_BOT_DISPLAY_NAME } from "@/lib/chat-neo-pulse";

export type ChatCallModalProps = {
  open: boolean;
  phase: ChatCallPhase;
  remoteDisplayName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  error: string | null;
  floMode?: boolean;
  floTranscript?: ChatCallTranscriptLine[];
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onDismissEnded: () => void;
};

function FloTranscriptPanel({ lines }: { lines: ChatCallTranscriptLine[] }): React.ReactElement {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="flex min-h-[280px] flex-1 flex-col gap-3 overflow-hidden rounded-md bg-zinc-900 p-4">
      <div className="flex items-center gap-3">
        <NeoPulseAvatar className="h-12 w-12" />
        <div>
          <p className="text-base font-semibold text-white">{NEO_PULSE_BOT_DISPLAY_NAME}</p>
          <p className="text-base text-white/60">Voice chat via transcription</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="text-base text-white/50">Speak to start the conversation.</p>
        ) : (
          lines.map((line, index) => (
            <div key={`${line.spokenAtMs}-${index}`} className="rounded-md bg-zinc-950/80 px-3 py-2">
              <span className="text-base font-semibold text-lime-400">{line.displayName}</span>
              <p className="text-base text-white/90">{line.text}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export function ChatCallModal({
  open,
  phase,
  remoteDisplayName,
  localStream,
  remoteStream,
  muted,
  cameraOff,
  error,
  floMode,
  floTranscript = [],
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onDismissEnded,
}: ChatCallModalProps): React.ReactElement {
  const title =
    phase === "outgoing"
      ? `Calling ${remoteDisplayName}…`
      : phase === "active"
        ? `Call with ${remoteDisplayName}`
        : phase === "ended"
          ? "Call ended"
          : "Call";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "ended") onDismissEnded();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 bg-zinc-950 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base text-white">{title}</DialogTitle>
        </DialogHeader>
        {error ? <p className="text-base text-red-400">{error}</p> : null}
        {phase === "active" || phase === "outgoing" ? (
          <>
            {floMode ? (
              <FloTranscriptPanel lines={floTranscript} />
            ) : (
              <div className="flex min-h-[240px] flex-1 flex-col gap-2 sm:min-h-[320px] sm:flex-row">
                <ChatVideoTile stream={remoteStream} label={remoteDisplayName} className="flex-1 bg-zinc-900" />
                <ChatVideoTile stream={localStream} label="You" mirrored className="flex-1 bg-zinc-900" />
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={onToggleMute}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              {!floMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
                  aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  onClick={onToggleCamera}
                >
                  {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                className="h-12 w-12 rounded-full bg-red-600 text-white hover:bg-red-700"
                aria-label="Hang up"
                onClick={onHangUp}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </>
        ) : phase === "ended" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-base text-white/70">Generating call notes in the chat thread…</p>
            <Button type="button" variant="ghost" className="text-base text-white" onClick={onDismissEnded}>
              Close
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
