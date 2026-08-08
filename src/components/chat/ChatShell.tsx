import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useTeamPermission } from "@/hooks/use-team-permission";
import { SEO_WORKSPACE_TYPO_CLASS } from "@/components/seo/seo-workspace-layout";
import { cn } from "@/lib/utils";
import { ArrowLeft, Hash, Radio, Settings } from "lucide-react";
import { ChatSidebar } from "@/components/chat/sidebar/ChatSidebar";
import { ChatMessageList } from "@/components/chat/thread/ChatMessageList";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/thread/ChatComposer";
import { ChatThreadPanel } from "@/components/chat/thread/ChatThreadPanel";
import { ChatSharedBrowser } from "@/components/chat/shared/ChatSharedBrowser";
import { ChatPanelResizeHandle } from "@/components/chat/shared/ChatPanelResizeHandle";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useChatPoll } from "@/components/chat/use-chat-poll";
import { useChatNotificationAlerts } from "@/hooks/use-chat-notification-alerts";
import {
  deleteChatMessage,
  editChatMessage,
  patchChatChannel,
  searchChatMessages,
  fetchChatMentions,
  fetchMentionUnreadCount,
  markChatMentionRead,
} from "@/lib/chat-api";
import type { ChatAlertItem } from "@/lib/chat-preferences-types";
import type { ChatMessage, ChatMentionInboxItem } from "@/lib/chat-types";
import { extractMentionUserIds } from "@/lib/chat-mention-utils";
import { ChatRichEditor, type ChatRichEditorHandle } from "@/components/chat/editor/ChatRichEditor";
import {
  CHAT_CHANNEL_BAR_CLASS,
  CHAT_CHANNEL_TITLE_CLASS,
  CHAT_MAIN_CLASS,
  CHAT_SCROLL_CLASS,
  CHAT_TEXT_MUTED,
  CHAT_TEXT_PRIMARY,
  chatRootDataAttrs,
  chatThemedRootClass,
  CHAT_INPUT_THEMED_CLASS,
  CHAT_ICON_BTN_CLASS,
  CHAT_TAB_ACTIVE_CLASS,
} from "@/components/chat/chat-theme";
import { chatZoneProps } from "@/lib/chat-theme-palettes";
import { ChatPersonalizationModal } from "@/components/chat/settings/ChatPersonalizationModal";
import { ChatFrontendWidgetToggle } from "@/components/chat/ChatFrontendWidgetToggle";
import { ChatNotificationPermissionPrompt } from "@/components/chat/ChatNotificationPermissionPrompt";
import { useChatPreferences } from "@/hooks/use-chat-preferences";
import { ChatDraftLinkPreviews } from "@/components/chat/editor/ChatDraftLinkPreviews";
import { chatMessageHash } from "@/lib/chat-activity-log";
import { transformChatHtml } from "@/lib/chat-ai-compose";
import { ChatCallModal } from "@/components/chat/calls/ChatCallModal";
import { ChatIncomingCallModal } from "@/components/chat/calls/ChatIncomingCallModal";
import { ChatFloHuddleJoinPopup } from "@/components/chat/calls/ChatFloHuddleJoinPopup";
import {
  ChatHuddleSidebar,
  type HuddleParticipantAvatar,
} from "@/components/chat/calls/ChatHuddleSidebar";
import { useChatCall } from "@/hooks/use-chat-call";
import { useChatCallTranscription } from "@/hooks/use-chat-call-transcription";
import { useChatFloCallTranscription } from "@/hooks/use-chat-flo-call-transcription";
import { useChatScreenShare } from "@/hooks/use-chat-screen-share";
import { isFloMember, FLO_DISPLAY_NAME } from "@/lib/chat-flo";
import { sendChatMessage } from "@/lib/chat-api";
import { fetchChatCallTranscript, fetchActiveHuddles, fetchIncomingChatCalls } from "@/lib/chat-call-api";
import { summarizeChatCall } from "@/lib/chat-call-summary";
import type { ActiveHuddleSummary } from "@/lib/chat-call-types";
import { readCachedActiveChannelId, readCachedMentionState, subscribeChatSessionCache, writeChatSessionCache } from "@/lib/chat-session-cache";

function streamHasLiveAudio(stream: MediaStream | null): boolean {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));
}

function channelTitle(activeChannel: { type: string; name: string; slug: string | null } | null, activeChannelId: number | null): string {
  if (!activeChannel) {
    return activeChannelId != null ? "" : "Select a channel";
  }
  if (activeChannel.type === "dm") return activeChannel.name;
  return activeChannel.slug ?? activeChannel.name;
}

function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}

function threadBarLabel(root: ChatMessage): string {
  const n = root.threadReplyCount ?? 0;
  if (n > 0) return `Thread · ${n === 1 ? "1 reply" : `${n} replies`}`;
  return "Thread · No replies yet";
}

export function ChatShell(): React.ReactElement {
  const { user } = useAuth();
  const { activeTeam, members, refreshMembers } = useTeam();
  const { canWrite } = useTeamPermission("communication");
  const teamId = activeTeam?.id ?? null;
  const isTeamAdmin = activeTeam?.accessRole === "owner" || activeTeam?.accessRole === "admin";
  const initialMentionState = teamId ? readCachedMentionState(teamId) : { mentions: [], mentionUnreadCount: 0 };
  const [activeChannelId, setActiveChannelId] = useState<number | null>(() =>
    teamId ? readCachedActiveChannelId(teamId) : null,
  );
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null);
  const [editHtml, setEditHtml] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [threadRoot, setThreadRoot] = useState<ChatMessage | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<number | null>(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchDebounced, setMessageSearchDebounced] = useState("");
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [sharedListEpoch, setSharedListEpoch] = useState(0);
  const [mentions, setMentions] = useState<ChatMentionInboxItem[]>(() => initialMentionState.mentions);
  const [mentionUnreadCount, setMentionUnreadCount] = useState(() => initialMentionState.mentionUnreadCount);
  const [activeMentionMessageId, setActiveMentionMessageId] = useState<number | null>(null);
  const [pendingMention, setPendingMention] = useState<ChatMentionInboxItem | null>(null);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const editEditorRef = useRef<ChatRichEditorHandle>(null);
  const mainComposerRef = useRef<ChatComposerHandle>(null);
  const threadComposerRef = useRef<ChatComposerHandle>(null);
  const summaryPostedRef = useRef<number | null>(null);
  const [activeHuddles, setActiveHuddles] = useState<ActiveHuddleSummary[]>([]);
  const [joinDismissedCallId, setJoinDismissedCallId] = useState<number | null>(null);
  const [huddleSidebarOpen, setHuddleSidebarOpen] = useState(false);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const {
    channels,
    messages,
    notificationMessages,
    threadsUnread,
    typingUsers,
    sending,
    isChannelHydrated,
    userSentRef,
    sendMessage,
    upsertChannel,
    setMessages,
    refreshChannels,
    loadThread,
    markThreadRead,
    pingTyping,
  } = useChatPoll({
    teamId,
    activeChannelId,
    enabled: true,
  });

  const { prefs, draft, savePrefs } = useChatPreferences();
  const themePrefs = personalizationOpen ? draft : prefs;

  const handleEnableDesktopAlerts = useCallback(async () => {
    return savePrefs({ notifications: { desktopAlerts: true } });
  }, [savePrefs]);
  const [noiseCancellationStrength, setNoiseCancellationStrength] = useState(
    () => prefs.behavior.noiseCancellationStrength ?? 75,
  );

  useEffect(() => {
    setNoiseCancellationStrength(prefs.behavior.noiseCancellationStrength ?? 75);
  }, [prefs.behavior.noiseCancellationStrength]);
  useEffect(() => {
    if (!teamId) return;
    void refreshMembers();
  }, [teamId, refreshMembers]);

  useEffect(() => {
    if (!teamId) {
      setActiveChannelId(null);
      setThreadRoot(null);
      setMessageSearchQuery("");
      setMessageSearchDebounced("");
      setSearchResults([]);
      return;
    }
    setActiveChannelId(readCachedActiveChannelId(teamId));
    const mentionState = readCachedMentionState(teamId);
    setMentions(mentionState.mentions);
    setMentionUnreadCount(mentionState.mentionUnreadCount);
    setThreadRoot(null);
    setMessageSearchQuery("");
    setMessageSearchDebounced("");
    setSearchResults([]);
  }, [teamId]);

  useEffect(() => {
    if (!teamId || activeChannelId == null) return;
    writeChatSessionCache(teamId, { activeChannelId });
  }, [teamId, activeChannelId]);

  useEffect(() => {
    if (!teamId) return;
    const applyMentionCache = () => {
      const state = readCachedMentionState(teamId);
      setMentions(state.mentions);
      setMentionUnreadCount(state.mentionUnreadCount);
    };
    return subscribeChatSessionCache((updatedTeamId) => {
      if (updatedTeamId !== teamId) return;
      applyMentionCache();
    });
  }, [teamId]);

  useEffect(() => {
    setMessageSearchQuery("");
    setMessageSearchDebounced("");
    setSearchResults([]);
  }, [activeChannelId]);

  useEffect(() => {
    const id = window.setTimeout(() => setMessageSearchDebounced(messageSearchQuery.trim()), 300);
    return () => window.clearTimeout(id);
  }, [messageSearchQuery]);

  useEffect(() => {
    if (!teamId || !activeChannelId || messageSearchDebounced === "") {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const list = await searchChatMessages(teamId, activeChannelId, messageSearchDebounced);
      if (!cancelled) setSearchResults(list);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [teamId, activeChannelId, messageSearchDebounced]);

  useEffect(() => {
    if (channels.length === 0) return;
    if (activeChannelId != null && channels.some((c) => c.id === activeChannelId)) return;
    const general = channels.find((c) => c.slug === "general" && c.type === "public");
    setActiveChannelId(general?.id ?? channels[0]!.id);
  }, [channels, activeChannelId]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  const floMember = useMemo(() => members.find(isFloMember) ?? null, [members]);
  const floUserId = floMember?.userId ?? null;
  const isFloDm =
    activeChannel?.type === "dm" && floUserId != null && activeChannel.dmUserId === floUserId;

  const {
    call: activeCall,
    phase: callPhase,
    incomingCall,
    setIncomingCall,
    localStream,
    remoteStream,
    muted: callMuted,
    cameraOff: callCameraOff,
    error: callError,
    callStartMs,
    floCall,
    isCaller,
    startOutgoing,
    startHuddle,
    joinHuddle,
    acceptIncoming,
    declineIncoming,
    hangUp,
    toggleMute,
    toggleCamera,
    dismissEnded,
    teardown,
    pcRef,
    maybeSendOffer,
    attachLocalTracks,
  } = useChatCall({
    teamId,
    currentUserId: user?.id ?? 0,
    floUserId,
    noiseCancellationStrength,
  });

  const incomingCallerName = useMemo(() => {
    if (!incomingCall) return "";
    const member = members.find((m) => m.userId === incomingCall.callerUserId);
    return member?.displayName ?? "Team member";
  }, [incomingCall, members]);

  const { alerts, activeAlertId, openAlert, dismissAlert } = useChatNotificationAlerts({
    teamId,
    prefs,
    channels,
    messages: notificationMessages,
    activeChannelId,
    currentUserId: user?.id ?? null,
    enabled: Boolean(teamId),
    mentions,
    incomingCall,
    incomingCallerName,
  });

  const callRemoteName = useMemo(() => {
    if (activeChannel?.type === "dm") return activeChannel.name;
    if (incomingCall) return incomingCallerName;
    const ch = activeCall ? channels.find((c) => c.id === activeCall.channelId) : null;
    return ch?.type === "dm" ? ch.name : "Team member";
  }, [activeChannel, incomingCall, incomingCallerName, activeCall, channels]);

  useChatCallTranscription({
    teamId,
    callId: activeCall?.id ?? null,
    active: callPhase === "active" && !floCall,
    muted: callMuted,
    userId: user?.id ?? 0,
    displayName: user?.displayName ?? user?.email ?? "You",
    callStartMs,
  });

  const inFloHuddle = callPhase === "active" && activeCall?.isFloHuddle === true;
  const huddleParticipantCount = activeCall?.participantCount ?? 1;
  const micReady = streamHasLiveAudio(localStream);
  const peerConnected = streamHasLiveAudio(remoteStream);

  const { screenStream, presenting, startPresent, stopPresent } = useChatScreenShare({
    pc: pcRef.current,
    enabled: inFloHuddle && huddleParticipantCount > 1,
    onRenegotiate: () => void maybeSendOffer(),
  });

  useEffect(() => {
    if (!inFloHuddle || localStream) return;
    void attachLocalTracks(true);
  }, [inFloHuddle, localStream, attachLocalTracks]);

  useEffect(() => {
    if (callPhase === "ended" || callPhase === "idle") {
      setHuddleSidebarOpen(false);
    }
  }, [callPhase]);

  const showHuddleButton =
    canWrite &&
    callPhase === "idle" &&
    activeChannel != null &&
    (activeChannel.type !== "dm" || isFloDm);

  const channelActiveHuddle = useMemo(
    () => activeHuddles.find((h) => h.channelId === activeChannelId) ?? null,
    [activeHuddles, activeChannelId],
  );

  const handleStartHuddle = useCallback(async () => {
    if (!activeChannelId) return;
    const call = await startHuddle(activeChannelId);
    if (call) {
      setHuddleSidebarOpen(true);
    }
  }, [activeChannelId, startHuddle]);

  const handleJoinChannelHuddle = useCallback(async () => {
    if (!channelActiveHuddle || !teamId) return;
    const call = await joinHuddle(channelActiveHuddle.callId);
    if (call) {
      setHuddleSidebarOpen(true);
    }
  }, [channelActiveHuddle, teamId, joinHuddle]);

  const handleLeaveHuddle = useCallback(async () => {
    await hangUp();
    setHuddleSidebarOpen(false);
  }, [hangUp]);

  const togglePresent = useCallback(() => {
    if (presenting) stopPresent();
    else void startPresent();
  }, [presenting, startPresent, stopPresent]);

  const handleNoiseCancellationStrengthChange = useCallback(
    (value: number) => {
      setNoiseCancellationStrength(value);
      void savePrefs({ behavior: { noiseCancellationStrength: value } });
    },
    [savePrefs],
  );

  const huddleDeepLinkRef = useRef(false);
  useEffect(() => {
    if (!teamId || huddleDeepLinkRef.current || inFloHuddle) return;
    const params = new URLSearchParams(window.location.search);
    const callId = Number(params.get("huddleCallId") ?? params.get("callId") ?? 0);
    if (!callId) return;
    huddleDeepLinkRef.current = true;
    void (async () => {
      const call = await joinHuddle(callId);
      if (call) {
        setActiveChannelId(call.channelId);
        setHuddleSidebarOpen(true);
      }
      params.delete("huddleCallId");
      params.delete("callId");
      params.delete("huddleTeamId");
      params.delete("teamId");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    })();
  }, [teamId, inFloHuddle, joinHuddle]);

  useEffect(() => {
    if (!teamId) {
      setActiveHuddles([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const huddles = await fetchActiveHuddles(teamId);
      if (!cancelled) setActiveHuddles(huddles);
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [teamId]);

  const joinPopupOpen = Boolean(
    channelActiveHuddle &&
      !channelActiveHuddle.joinedByMe &&
      joinDismissedCallId !== channelActiveHuddle.callId &&
      callPhase === "idle",
  );

  const joinParticipantNames = useMemo(() => {
    if (!channelActiveHuddle) return [];
    return channelActiveHuddle.participantUserIds
      .map((id) => members.find((m) => m.userId === id)?.displayName ?? "Member")
      .filter(Boolean);
  }, [channelActiveHuddle, members]);

  const huddleChannelLabel = useMemo(() => {
    const ch = activeCall ? channels.find((c) => c.id === activeCall.channelId) : activeChannel;
    if (!ch) return "channel";
    if (ch.type === "dm") return ch.name;
    return ch.slug ? `#${ch.slug}` : ch.name;
  }, [activeCall, channels, activeChannel]);

  const huddleRemoteLabel = useMemo(() => {
    if (!activeCall?.participantUserIds) return "Peer";
    const floId = floUserId ?? 0;
    for (const id of activeCall.participantUserIds) {
      if (id === user?.id || id === floId) continue;
      return members.find((m) => m.userId === id)?.displayName ?? "Peer";
    }
    return "Peer";
  }, [activeCall?.participantUserIds, floUserId, members, user?.id]);

  const huddleParticipantAvatars = useMemo((): HuddleParticipantAvatar[] => {
    const ids = activeCall?.participantUserIds ?? (user?.id ? [user.id] : []);
    const floId = floUserId ?? 0;
    const seen = new Set<number>();
    const out: HuddleParticipantAvatar[] = [];

    const pushMember = (userId: number, isFlo = false) => {
      if (seen.has(userId)) return;
      seen.add(userId);
      const isSelf = userId === user?.id;
      const micActive = isSelf ? micReady && !callMuted : peerConnected;
      if (isFlo) {
        out.push({ userId, displayName: FLO_DISPLAY_NAME, isFlo: true });
        return;
      }
      const member = members.find((m) => m.userId === userId);
      out.push({
        userId,
        displayName: member?.displayName ?? "Member",
        avatarUrl: member?.avatarUrl ?? null,
        micActive,
      });
    };

    for (const id of ids) pushMember(id);
    if (floId) pushMember(floId, true);
    if (user?.id) pushMember(user.id);

    return out;
  }, [activeCall?.participantUserIds, floUserId, members, user?.id, micReady, callMuted, peerConnected]);

  const { lines: floTranscriptLines } = useChatFloCallTranscription({
    teamId,
    callId: activeCall?.id ?? null,
    active: callPhase === "active" && floCall && activeCall?.isFloHuddle !== true,
    muted: callMuted,
    displayName: user?.displayName ?? user?.email ?? "You",
    callStartMs,
    floCall,
  });

  useEffect(() => {
    if (!teamId || callPhase !== "idle") return;
    let cancelled = false;
    const poll = async () => {
      const incoming = await fetchIncomingChatCalls(teamId);
      if (cancelled || incoming.length === 0) return;
      const next = incoming[0]!;
      if (callPhase === "idle" && !activeCall) {
        setIncomingCall(next);
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [teamId, callPhase, activeCall, setIncomingCall]);

  useEffect(() => {
    if (!teamId || !activeCall || callPhase !== "ended" || !isCaller) return;
    if (summaryPostedRef.current === activeCall.id) return;
    summaryPostedRef.current = activeCall.id;

    const run = async () => {
      const channelId = activeCall.channelId;
      const started = new Date(activeCall.startedAt).getTime();
      const ended = activeCall.endedAt ? new Date(activeCall.endedAt).getTime() : Date.now();
      const durationSec = Math.max(1, Math.round((ended - started) / 1000));
      const transcript = await fetchChatCallTranscript(teamId, activeCall.id);
      const callerMember = members.find((m) => m.userId === activeCall.callerUserId);
      const calleeMember = members.find((m) => m.userId === activeCall.calleeUserId);
      const names = [
        callerMember?.displayName ?? "Caller",
        calleeMember?.displayName ?? "Callee",
      ];
      const summary = await summarizeChatCall(transcript, names, durationSec);
      if (summary.ok) {
        await sendChatMessage(teamId, channelId, summary.bodyHtml);
        await refreshChannels();
      }
    };
    void run();
  }, [teamId, activeCall, callPhase, isCaller, members, refreshChannels]);

  const mentionMembers = useMemo(
    () => members.map((m) => ({ userId: m.userId, displayName: m.displayName, email: m.email })),
    [members],
  );

  const threadUnreadMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of threadsUnread) map.set(t.threadRootId, t.unreadCount);
    return map;
  }, [threadsUnread]);

  const handleAiCorrect = useCallback(
    async (message: ChatMessage) => {
      const composer = threadRoot ? threadComposerRef : mainComposerRef;
      const result = await transformChatHtml(message.bodyHtml, "correct");
      if (result.ok) {
        composer.current?.setHtml(result.bodyHtml);
      }
    },
    [threadRoot],
  );

  const handleSend = async (html: string, attachmentAssetIds: number[]) => {
    await sendMessage(html, attachmentAssetIds);
  };

  const openThread = (message: ChatMessage) => {
    setMessageSearchQuery("");
    setMessageSearchDebounced("");
    setSearchResults([]);
    setThreadSearchQuery("");
    setThreadRoot(message);
  };

  const closeThread = () => {
    setThreadRoot(null);
    setThreadSearchQuery("");
    setHighlightMessageId(null);
  };

  const handleJumpToMessage = (messageId: number) => {
    closeThread();
    setHighlightMessageId(messageId);
    window.location.hash = chatMessageHash(messageId);
  };

  const handleOpenThreadFromBrowser = (threadRootId: number, messageId: number) => {
    const root = messages.find((m) => m.id === threadRootId);
    if (root) {
      openThread(root);
      setHighlightMessageId(messageId);
    } else {
      handleJumpToMessage(messageId);
    }
  };

  const refreshMentions = useCallback(async () => {
    if (!teamId) {
      setMentions([]);
      setMentionUnreadCount(0);
      return;
    }
    try {
      const [list, count] = await Promise.all([
        fetchChatMentions(teamId, { limit: 30 }),
        fetchMentionUnreadCount(teamId),
      ]);
      setMentions(list);
      setMentionUnreadCount(count);
      writeChatSessionCache(teamId, { mentions: list, mentionUnreadCount: count });
    } catch {
      // keep last good state
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    void refreshMentions();
    const id = window.setInterval(() => void refreshMentions(), 3000);
    return () => window.clearInterval(id);
  }, [teamId, refreshMentions]);

  const handleOpenMention = useCallback(
    (item: ChatMentionInboxItem) => {
      setActiveMentionMessageId(item.messageId);
      setPendingMention(item);
      setActiveChannelId(item.channelId);
      setMessageSearchQuery("");
      setMessageSearchDebounced("");
      setSearchResults([]);
      closeThread();
      if (teamId) void markChatMentionRead(teamId, item.messageId).then(() => refreshMentions());
    },
    [teamId, refreshMentions],
  );

  const handleOpenAlert = useCallback(
    (alert: ChatAlertItem) => {
      openAlert(alert);
      setActiveChannelId(alert.channelId);
      setMessageSearchQuery("");
      setMessageSearchDebounced("");
      setSearchResults([]);
      closeThread();
      if (alert.messageId > 0) {
        setHighlightMessageId(alert.messageId);
        window.location.hash = chatMessageHash(alert.messageId);
      }
      dismissAlert(alert.id);
    },
    [openAlert, dismissAlert],
  );

  useEffect(() => {
    if (!pendingMention || !teamId || activeChannelId !== pendingMention.channelId || !isChannelHydrated) {
      return;
    }
    const item = pendingMention;
    let cancelled = false;

    const finish = (messageId: number) => {
      if (cancelled) return;
      setHighlightMessageId(messageId);
      window.location.hash = chatMessageHash(messageId);
      setPendingMention(null);
    };

    if (item.threadRootId) {
      void loadThread(item.threadRootId).then((threadMsgs) => {
        if (cancelled) return;
        const root = threadMsgs.find((m) => m.id === item.threadRootId) ?? messages.find((m) => m.id === item.threadRootId);
        if (root) openThread(root);
        finish(item.messageId);
      });
    } else {
      finish(item.messageId);
    }

    return () => {
      cancelled = true;
    };
  }, [pendingMention, teamId, activeChannelId, isChannelHydrated, loadThread, messages]);

  useEffect(() => {
    if (!teamId || highlightMessageId == null) return;
    void markChatMentionRead(teamId, highlightMessageId).then(() => refreshMentions());
  }, [teamId, highlightMessageId, refreshMentions]);

  const handleEdit = (message: ChatMessage) => {
    setEditTarget(message);
    setEditHtml(message.bodyHtml);
  };

  const handleSaveEdit = async () => {
    if (!teamId || !editTarget) return;
    setEditBusy(true);
    try {
      const html = editEditorRef.current?.getHtml() ?? editHtml;
      const mentionedUserIds = extractMentionUserIds(html);
      const result = await editChatMessage(teamId, editTarget.id, html, undefined, mentionedUserIds);
      if (result.ok && result.message) {
        setMessages((prev) => prev.map((m) => (m.id === result.message!.id ? result.message! : m)));
        setEditTarget(null);
      }
    } finally {
      setEditBusy(false);
    }
  };

  const messageSearchActive = messageSearchDebounced.length > 0;
  const displayedMessages = messageSearchActive ? searchResults : messages;

  const liveDisplayMessages = useMemo(() => {
    const byUser = new Map(members.map((m) => [m.userId, m.displayName]));
    const selfName = prefs.profile.displayName.trim() || user?.displayName || "";
    return displayedMessages.map((m) => {
      if (m.userId === user?.id && selfName) {
        return { ...m, displayName: selfName };
      }
      const live = byUser.get(m.userId);
      return live ? { ...m, displayName: live } : m;
    });
  }, [displayedMessages, members, prefs.profile.displayName, user?.id, user?.displayName]);

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!teamId) return;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    setSearchResults((prev) => prev.filter((m) => m.id !== message.id));
    setSharedListEpoch((n) => n + 1);
    const result = await deleteChatMessage(teamId, message.id);
    if (result.ok) {
      await refreshChannels();
    }
  };

  const saveTopic = async () => {
    if (!teamId || !activeChannelId || !canWrite) return;
    const result = await patchChatChannel(teamId, activeChannelId, { topic: topicDraft });
    if (result.ok && result.channel) upsertChannel(result.channel);
    setEditingTopic(false);
  };

  const showRightRail = Boolean(teamId && activeChannelId);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (showRightRail) panel.expand();
    else panel.collapse();
  }, [showRightRail]);

  const canEditTopic =
    canWrite && activeChannel && (activeChannel.type === "public" || activeChannel.type === "private");

  if (!activeTeam) {
    return (
      <div className={cn("flex h-full min-h-0 flex-1 items-center justify-center font-sans text-base")}>
        <p className={cn("text-base", CHAT_TEXT_MUTED)}>Select a team to use chat.</p>
      </div>
    );
  }

  const appearance = themePrefs.appearance;
  const leftZone = chatZoneProps(appearance.zoneThemes.left, appearance.accentPreset, "chat-zone-left");
  const mainZone = chatZoneProps(
    appearance.zoneThemes.main,
    appearance.accentPreset,
    cn("chat-zone-main", CHAT_MAIN_CLASS),
  );
  const rightZone = chatZoneProps(appearance.zoneThemes.right, appearance.accentPreset, "chat-zone-right");

  return (
    <div
      className={chatThemedRootClass(SEO_WORKSPACE_TYPO_CLASS)}
      {...chatRootDataAttrs(appearance)}
    >
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId={teamId ? `flowbie-chat-${teamId}` : undefined}
        className="min-h-0 min-w-0 flex-1"
      >
        <ResizablePanel defaultSize={15} minSize={12} maxSize={28} className="min-w-0">
          <ChatSidebar
            channels={channels}
            activeChannelId={activeChannelId}
            canWrite={canWrite}
            onSelectChannel={(id) => {
              setActiveChannelId(id);
              closeThread();
            }}
            onChannelCreated={upsertChannel}
            onDmOpened={upsertChannel}
            mentions={mentions}
            mentionUnreadCount={mentionUnreadCount}
            activeMentionMessageId={activeMentionMessageId}
            onOpenMention={handleOpenMention}
            alerts={alerts}
            activeAlertId={activeAlertId}
            onOpenAlert={handleOpenAlert}
            onDismissAlert={dismissAlert}
            sidebarSections={themePrefs.appearance.sidebarSections}
            activeHuddles={activeHuddles}
            zoneClassName={leftZone.className}
            zoneStyle={leftZone.style}
            zoneTheme={leftZone["data-zone-theme"]}
          />
        </ResizablePanel>
        <ChatPanelResizeHandle />
        <ResizablePanel defaultSize={60} minSize={35} className="min-w-0">
          <div
            {...mainZone}
            className={cn(mainZone.className, "flex h-full min-h-0 min-w-0 flex-col overflow-hidden")}
          >
            <div className={CHAT_CHANNEL_BAR_CLASS}>
              {activeChannelId ? (
                threadRoot ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn("h-8 shrink-0 gap-1 px-2 text-base chat-text-muted hover:chat-text-primary")}
                      onClick={closeThread}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to #{channelTitle(activeChannel, activeChannelId)}
                    </Button>
                    <span className={cn("shrink-0 text-base font-bold", CHAT_TEXT_PRIMARY)}>
                      {threadBarLabel(threadRoot)}
                    </span>
                    <div className="ml-auto flex min-w-0 max-w-xs flex-1 items-center justify-end">
                      <Input
                        value={threadSearchQuery}
                        onChange={(e) => setThreadSearchQuery(e.target.value)}
                        placeholder="Search in thread"
                        className={cn("h-8 text-base", CHAT_INPUT_THEMED_CLASS)}
                        aria-label="Search in thread"
                      />
                    </div>
                  </>
                ) : (
                <>
                  {activeChannel && activeChannel.type !== "dm" ? (
                    <Hash className={cn("h-5 w-5 shrink-0", CHAT_TEXT_MUTED)} aria-hidden />
                  ) : null}
                  <h2 className={CHAT_CHANNEL_TITLE_CLASS}>
                    {channelTitle(activeChannel, activeChannelId)}
                  </h2>
                  {activeChannel && activeChannel.type !== "dm" ? (
                    editingTopic && canEditTopic ? (
                      <input
                        value={topicDraft}
                        onChange={(e) => setTopicDraft(e.target.value)}
                        onBlur={() => void saveTopic()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveTopic();
                          if (e.key === "Escape") setEditingTopic(false);
                        }}
                        className={cn("min-w-0 max-w-xs flex-1 bg-transparent text-base outline-none", CHAT_TEXT_MUTED)}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className={cn("min-w-0 truncate text-base", CHAT_TEXT_MUTED)}
                        onClick={() => {
                          if (!canEditTopic) return;
                          setTopicDraft(activeChannel.topic ?? "");
                          setEditingTopic(true);
                        }}
                      >
                        {activeChannel.topic?.trim() || (canEditTopic ? "Add topic" : "")}
                      </button>
                    )
                  ) : null}
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {user && isTeamAdmin ? (
                      <ChatFrontendWidgetToggle disabled={!teamId} />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("h-8 w-8 shrink-0", CHAT_ICON_BTN_CLASS)}
                      aria-label="Chat personalization"
                      onClick={() => setPersonalizationOpen(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {inFloHuddle ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-8 shrink-0 gap-1 px-3 text-base",
                          huddleSidebarOpen && CHAT_TAB_ACTIVE_CLASS,
                        )}
                        onClick={() => setHuddleSidebarOpen((open) => !open)}
                      >
                        <Radio className="h-4 w-4" />
                        Huddle
                      </Button>
                    ) : showHuddleButton ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 shrink-0 gap-1 px-3 text-base"
                        onClick={() => void handleStartHuddle()}
                      >
                        <Radio className="h-4 w-4" />
                        Huddle
                      </Button>
                    ) : null}
                    <Input
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      placeholder="Search messages"
                      className={cn("h-8 w-44 shrink-0 text-base", CHAT_INPUT_THEMED_CLASS)}
                      aria-label="Search messages"
                    />
                    {themePrefs.behavior.showTypingIndicators && typingUsers.length > 0 ? (
                      <span className={cn("hidden truncate text-base italic sm:block", CHAT_TEXT_MUTED)}>
                        {typingLabel(typingUsers.map((u) => u.displayName))}
                      </span>
                    ) : null}
                  </div>
                </>
                )
              ) : (
                <span className={cn("text-base", CHAT_TEXT_MUTED)}>Select a channel</span>
              )}
            </div>
            {teamId ? (
              <ChatNotificationPermissionPrompt
                teamId={teamId}
                onEnableDesktopAlerts={handleEnableDesktopAlerts}
              />
            ) : null}
            <div className={cn(CHAT_SCROLL_CLASS, "min-h-0 flex-1 p-0")}>
              {teamId && activeChannelId && threadRoot ? (
                <ChatThreadPanel
                  teamId={teamId}
                  channelId={activeChannelId}
                  threadRoot={threadRoot}
                  members={mentionMembers}
                  currentUserId={user?.id ?? 0}
                  canWrite={canWrite}
                  isTeamAdmin={isTeamAdmin}
                  loadThread={loadThread}
                  markThreadRead={markThreadRead}
                  sendMessage={sendMessage}
                  pingTyping={pingTyping}
                  sending={sending}
                  highlightMessageId={highlightMessageId}
                  threadSearchQuery={threadSearchQuery}
                  onEdit={handleEdit}
                  onDelete={(message) => void handleDeleteMessage(message)}
                  onAiCorrect={handleAiCorrect}
                  composerRef={threadComposerRef}
                />
              ) : teamId && activeChannelId ? (
                <ChatMessageList
                  teamId={teamId}
                  messages={liveDisplayMessages}
                  currentUserId={user?.id ?? 0}
                  hydrated={isChannelHydrated}
                  canWrite={canWrite}
                  isTeamAdmin={isTeamAdmin}
                  highlightMessageId={highlightMessageId}
                  threadUnreadMap={threadUnreadMap}
                  userSentRef={userSentRef}
                  searchActive={messageSearchActive}
                  onHighlightDone={() => setHighlightMessageId(null)}
                  onEdit={handleEdit}
                  onDelete={(message) => void handleDeleteMessage(message)}
                  onAiCorrect={handleAiCorrect}
                  onReplyInThread={openThread}
                />
              ) : null}
            </div>
            {teamId && activeChannelId && !threadRoot ? (
              <ChatComposer
                ref={mainComposerRef}
                teamId={teamId}
                channelId={activeChannelId}
                members={mentionMembers}
                disabled={!canWrite || !activeChannelId}
                sending={sending}
                onSend={handleSend}
                onTyping={pingTyping}
                enterToSend={themePrefs.behavior.enterToSend}
                showLinkPreviews={themePrefs.behavior.showLinkPreviews}
              />
            ) : null}
          </div>
        </ResizablePanel>
        <ChatPanelResizeHandle />
        <ResizablePanel
          ref={rightPanelRef}
          defaultSize={25}
          minSize={18}
          maxSize={42}
          collapsible
          collapsedSize={0}
          className="min-w-0"
        >
          {inFloHuddle && huddleSidebarOpen ? (
            <ChatHuddleSidebar
              channelLabel={huddleChannelLabel}
              participantAvatars={huddleParticipantAvatars}
              participantCount={huddleParticipantCount}
              localStream={localStream}
              remoteStream={remoteStream}
              muted={callMuted}
              cameraOff={callCameraOff}
              micReady={micReady}
              peerConnected={peerConnected}
              presenting={presenting}
              screenStream={screenStream}
              callError={callError}
              remotePeerLabel={huddleRemoteLabel}
              currentUserId={user?.id ?? 0}
              zoneClassName={rightZone.className}
              zoneStyle={rightZone.style}
              zoneTheme={rightZone["data-zone-theme"]}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onTogglePresent={togglePresent}
              onLeave={() => void handleLeaveHuddle()}
              onClose={() => setHuddleSidebarOpen(false)}
              noiseCancellationStrength={noiseCancellationStrength}
              onNoiseCancellationStrengthChange={handleNoiseCancellationStrengthChange}
            />
          ) : teamId && activeChannelId ? (
            <ChatSharedBrowser
              teamId={teamId}
              channelId={activeChannelId}
              channels={channels}
              members={members}
              currentUserId={user?.id ?? 0}
              isTeamAdmin={isTeamAdmin}
              canWrite={canWrite}
              refreshKey={sharedListEpoch}
              onJumpToMessage={handleJumpToMessage}
              onOpenThread={handleOpenThreadFromBrowser}
              zoneClassName={rightZone.className}
              zoneStyle={rightZone.style}
              zoneTheme={rightZone["data-zone-theme"]}
            />
          ) : null}
        </ResizablePanel>
      </ResizablePanelGroup>

      {personalizationOpen ? (
        <ChatPersonalizationModal open={personalizationOpen} onOpenChange={setPersonalizationOpen} />
      ) : null}

      <ChatIncomingCallModal
        call={incomingCall}
        callerDisplayName={incomingCallerName}
        onAccept={() => {
          if (incomingCall) setActiveChannelId(incomingCall.channelId);
          void acceptIncoming();
        }}
        onDecline={() => void declineIncoming()}
      />
      <ChatFloHuddleJoinPopup
        open={joinPopupOpen}
        channelLabel={channelTitle(activeChannel, activeChannelId)}
        huddle={channelActiveHuddle}
        participantNames={joinParticipantNames}
        onJoin={() => void handleJoinChannelHuddle()}
        onDismiss={() => {
          if (channelActiveHuddle) setJoinDismissedCallId(channelActiveHuddle.callId);
        }}
      />
      <ChatCallModal
        open={
          !floCall && (callPhase === "outgoing" || callPhase === "active" || callPhase === "ended")
        }
        phase={callPhase}
        remoteDisplayName={callRemoteName}
        localStream={localStream}
        remoteStream={remoteStream}
        muted={callMuted}
        cameraOff={callCameraOff}
        error={callError}
        floMode={floCall}
        floTranscript={floTranscriptLines}
        onHangUp={() => void hangUp()}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onDismissEnded={dismissEnded}
      />

      <Dialog
        open={editTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="bg-white text-zinc-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit message</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <>
              <ChatRichEditor
                ref={editEditorRef}
                key={editTarget.id}
                members={mentionMembers}
                content={editTarget.bodyHtml}
                disabled={editBusy}
                placeholder="Edit message…"
                onChange={setEditHtml}
                onSubmit={() => void handleSaveEdit()}
                showAiToolbar={!editBusy}
                submitOnEnter={false}
              />
              <ChatDraftLinkPreviews teamId={teamId} html={editHtml} className="rounded-md border border-zinc-200" />
            </>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-base"
              onClick={() => {
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="text-base" disabled={editBusy} onClick={() => void handleSaveEdit()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
