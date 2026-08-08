export type ChatCallStatus = "ringing" | "active" | "ended" | "declined" | "missed";

export type ChatCall = {
  id: number;
  teamId: number;
  channelId: number;
  callerUserId: number;
  calleeUserId: number;
  status: ChatCallStatus;
  startedAt: string;
  endedAt: string | null;
  isFloHuddle?: boolean;
  participantCount?: number;
  participantUserIds?: number[];
};

export type ActiveHuddleSummary = {
  callId: number;
  channelId: number;
  startedAt: string;
  participantCount: number;
  participantUserIds: number[];
  joinedByMe: boolean;
};

export type ChatCallSignalPayload =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export type ChatCallSignal = {
  id: number;
  fromUserId: number;
  payload: ChatCallSignalPayload;
  createdAt: string;
};

export type ChatCallTranscriptLine = {
  userId: number;
  displayName: string;
  text: string;
  spokenAtMs: number;
};

export type ChatCallPhase = "idle" | "outgoing" | "incoming" | "active" | "ended";
