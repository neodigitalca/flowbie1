import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptChatCall,
  declineChatCall,
  endChatCall,
  fetchChatCall,
  joinChatHuddle,
  pollChatCallSignals,
  sendChatCallSignal,
  startChatCall,
} from "@/lib/chat-call-api";
import type { ChatCall, ChatCallPhase, ChatCallSignalPayload } from "@/lib/chat-call-types";
import {
  clampNoiseCancellationStrength,
  applyCallAudioProcessing,
  buildCallAudioConstraints,
  createCallAudioProcessor,
  mergeProcessedCallStream,
  type CallAudioProcessorHandle,
} from "@/lib/call-audio-constraints";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type UseChatCallArgs = {
  teamId: number | null;
  currentUserId: number;
  floUserId: number | null;
  noiseCancellationStrength?: number;
};

function isFloCall(call: ChatCall | null, floUserId: number | null): boolean {
  if (!call || !floUserId) return false;
  return call.isFloHuddle === true || call.callerUserId === floUserId || call.calleeUserId === floUserId;
}

function callStartFromStartedAt(startedAt: string | undefined): number {
  if (!startedAt) return Date.now();
  const ms = new Date(startedAt).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

export function useChatCall({
  teamId,
  currentUserId,
  floUserId,
  noiseCancellationStrength = 75,
}: UseChatCallArgs) {
  const [call, setCall] = useState<ChatCall | null>(null);
  const [phase, setPhase] = useState<ChatCallPhase>("idle");
  const [incomingCall, setIncomingCall] = useState<ChatCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStartMs, setCallStartMs] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalSinceRef = useRef(0);
  const isCallerRef = useRef(false);
  const offerSentRef = useRef(false);
  const audioProcessorRef = useRef<CallAudioProcessorHandle | null>(null);
  const rawLocalStreamRef = useRef<MediaStream | null>(null);
  const ncStrengthRef = useRef(noiseCancellationStrength);

  ncStrengthRef.current = noiseCancellationStrength;

  const cleanupMedia = useCallback(() => {
    audioProcessorRef.current?.dispose();
    audioProcessorRef.current = null;
    rawLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawLocalStreamRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    pcRef.current?.close();
    pcRef.current = null;
    signalSinceRef.current = 0;
    offerSentRef.current = false;
  }, [localStream]);

  const teardown = useCallback(() => {
    cleanupMedia();
    setCall(null);
    setPhase("idle");
    setError(null);
    isCallerRef.current = false;
  }, [cleanupMedia]);

  const attachLocalTracks = useCallback(async (withVideo = true): Promise<MediaStream | null> => {
    const strength = ncStrengthRef.current;
    try {
      audioProcessorRef.current?.dispose();
      audioProcessorRef.current = null;
      rawLocalStreamRef.current?.getTracks().forEach((t) => t.stop());

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: buildCallAudioConstraints(strength),
        video: withVideo,
      });
      rawLocalStreamRef.current = rawStream;

      const audioTrack = rawStream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          await applyCallAudioProcessing(audioTrack, strength);
        } catch {
          /* browser may reject re-apply; stream still usable */
        }
      }

      let outputStream = rawStream;
      if (audioTrack) {
        const processor = createCallAudioProcessor(rawStream, strength);
        if (processor) {
          audioProcessorRef.current = processor;
          outputStream = mergeProcessedCallStream(rawStream, processor.stream);
        }
      }

      setLocalStream(outputStream);
      setError(null);
      return outputStream;
    } catch {
      setError(withVideo ? "Microphone or camera access denied" : "Microphone access denied");
      return null;
    }
  }, []);

  useEffect(() => {
    const strength = clampNoiseCancellationStrength(noiseCancellationStrength);
    audioProcessorRef.current?.setStrength(strength);
    const rawTrack = rawLocalStreamRef.current?.getAudioTracks()[0];
    if (!rawTrack) return;
    void applyCallAudioProcessing(rawTrack, strength).catch(() => undefined);
  }, [noiseCancellationStrength]);

  const floCall = isFloCall(call, floUserId);
  const participantCount = call?.participantCount ?? 1;
  const useWebRtc = call != null && (!floCall || (call.isFloHuddle && participantCount > 1));

  const ensurePc = useCallback(
    (stream: MediaStream, callId: number) => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (ev) => {
        const [remote] = ev.streams;
        if (remote) setRemoteStream(remote);
      };
      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !teamId) return;
        void sendChatCallSignal(teamId, callId, {
          type: "ice",
          candidate: ev.candidate.toJSON(),
        });
      };
      pcRef.current = pc;
      return pc;
    },
    [teamId],
  );

  const handleSignal = useCallback(
    async (callId: number, payload: ChatCallSignalPayload) => {
      if (!teamId || !call || !useWebRtc) return;
      const stream = localStream ?? (await attachLocalTracks());
      if (!stream) return;
      const pc = ensurePc(stream, callId);

      if (payload.type === "offer") {
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendChatCallSignal(teamId, callId, { type: "answer", sdp: answer.sdp ?? "" });
      } else if (payload.type === "answer") {
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      } else if (payload.type === "ice") {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          /* ignore stale candidates */
        }
      }
    },
    [teamId, call, useWebRtc, localStream, attachLocalTracks, ensurePc],
  );

  const pollSignals = useCallback(async () => {
    if (!teamId || !call || !useWebRtc) return;
    const signals = await pollChatCallSignals(teamId, call.id, signalSinceRef.current);
    for (const sig of signals) {
      signalSinceRef.current = Math.max(signalSinceRef.current, sig.id);
      if (sig.fromUserId === currentUserId) continue;
      await handleSignal(call.id, sig.payload);
    }
  }, [teamId, call, useWebRtc, currentUserId, handleSignal]);

  const maybeSendOffer = useCallback(async () => {
    if (!teamId || !call || !isCallerRef.current || offerSentRef.current || !useWebRtc) return;
    if (call.status !== "active") return;
    offerSentRef.current = true;
    const stream = localStream ?? (await attachLocalTracks());
    if (!stream) return;
    const pc = ensurePc(stream, call.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendChatCallSignal(teamId, call.id, { type: "offer", sdp: offer.sdp ?? "" });
  }, [teamId, call, useWebRtc, localStream, attachLocalTracks, ensurePc]);

  const activateCall = useCallback((nextCall: ChatCall) => {
    setCall(nextCall);
    setPhase("active");
    setCallStartMs(callStartFromStartedAt(nextCall.startedAt));
  }, []);

  useEffect(() => {
    if (!teamId || !call || (phase !== "active" && phase !== "outgoing")) return;
    const id = window.setInterval(() => {
      void pollSignals();
    }, 1500);
    return () => window.clearInterval(id);
  }, [teamId, call, phase, pollSignals]);

  useEffect(() => {
    if (!teamId || !call || (phase !== "outgoing" && phase !== "active")) return;
    const id = window.setInterval(async () => {
      const result = await fetchChatCall(teamId, call.id);
      if (!result.ok || !result.call) return;
      setCall(result.call);
      if (result.call.status === "active" && phase === "outgoing") {
        activateCall(result.call);
        await maybeSendOffer();
      }
      if (result.call.status === "declined" || result.call.status === "missed" || result.call.status === "ended") {
        setPhase("ended");
        cleanupMedia();
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [teamId, call, phase, maybeSendOffer, cleanupMedia, activateCall]);

  useEffect(() => {
    if (!teamId || !call || phase !== "active") return;
    const id = window.setInterval(async () => {
      const result = await fetchChatCall(teamId, call.id);
      if (!result.ok || !result.call) return;
      setCall(result.call);
      if (result.call.status === "ended" || result.call.status === "declined" || result.call.status === "missed") {
        setPhase("ended");
        cleanupMedia();
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [teamId, call, phase, cleanupMedia]);

  const startHuddle = useCallback(
    async (channelId: number) => {
      if (!teamId) return null;
      setError(null);
      isCallerRef.current = true;
      const result = await startChatCall(teamId, channelId, { floHuddle: true });
      if (!result.ok || !result.call) {
        setError(result.error ?? "Could not start huddle");
        return null;
      }
      setCall(result.call);
      if (result.call.status === "active") {
        activateCall(result.call);
      } else {
        setPhase("outgoing");
      }
      return result.call;
    },
    [teamId, activateCall],
  );

  const joinHuddle = useCallback(
    async (callId: number) => {
      if (!teamId) return null;
      setError(null);
      isCallerRef.current = false;
      const result = await joinChatHuddle(teamId, callId);
      if (!result.ok || !result.call) {
        setError(result.error ?? "Could not join huddle");
        return null;
      }
      activateCall(result.call);
      signalSinceRef.current = 0;
      return result.call;
    },
    [teamId, activateCall],
  );

  useEffect(() => {
    if (!useWebRtc || phase !== "active") return;
    void (async () => {
      if (!localStream) {
        const stream = await attachLocalTracks(true);
        if (!stream) return;
      }
      await maybeSendOffer();
    })();
  }, [useWebRtc, phase, localStream, attachLocalTracks, maybeSendOffer]);

  const startOutgoing = useCallback(
    async (channelId: number, options?: { flo?: boolean }) => {
      if (!teamId) return;
      if (options?.flo !== false) {
        await startHuddle(channelId);
        return;
      }
      setError(null);
      isCallerRef.current = true;
      try {
        await attachLocalTracks(true);
      } catch {
        setError("Microphone or camera access denied");
        return;
      }
      const result = await startChatCall(teamId, channelId, { floHuddle: false });
      if (!result.ok || !result.call) {
        setError(result.error ?? "Could not start call");
        cleanupMedia();
        return;
      }
      setCall(result.call);
      setPhase("outgoing");
    },
    [teamId, startHuddle, attachLocalTracks, cleanupMedia],
  );

  const acceptIncoming = useCallback(async () => {
    if (!teamId || !incomingCall) return;
    setError(null);
    isCallerRef.current = false;
    try {
      await attachLocalTracks();
    } catch {
      setError("Microphone or camera access denied");
      return;
    }
    const result = await acceptChatCall(teamId, incomingCall.id);
    if (!result.ok || !result.call) {
      setError(result.error ?? "Could not accept call");
      cleanupMedia();
      return;
    }
    setIncomingCall(null);
    activateCall(result.call);
    signalSinceRef.current = 0;
  }, [teamId, incomingCall, attachLocalTracks, cleanupMedia, activateCall]);

  const declineIncoming = useCallback(async () => {
    if (!teamId || !incomingCall) return;
    await declineChatCall(teamId, incomingCall.id);
    setIncomingCall(null);
  }, [teamId, incomingCall]);

  const hangUp = useCallback(async () => {
    if (!teamId || !call) {
      teardown();
      return;
    }
    const ended = await endChatCall(teamId, call.id);
    if (ended.call) setCall(ended.call);
    setPhase("ended");
    cleanupMedia();
  }, [teamId, call, teardown, cleanupMedia]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStream?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    setCameraOff((c) => {
      const next = !c;
      localStream?.getVideoTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, [localStream]);

  const dismissEnded = useCallback(() => {
    teardown();
  }, [teardown]);

  return {
    call,
    phase,
    incomingCall,
    setIncomingCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    error,
    callStartMs,
    floCall,
    useWebRtc,
    pcRef,
    isCaller: call != null && call.callerUserId === currentUserId,
    startOutgoing,
    startHuddle,
    joinHuddle,
    acceptIncoming,
    declineIncoming,
    hangUp,
    toggleMute,
    toggleCamera,
    dismissEnded,
    setCall,
    activateCall,
    teardown,
    maybeSendOffer,
    attachLocalTracks,
  };
}
