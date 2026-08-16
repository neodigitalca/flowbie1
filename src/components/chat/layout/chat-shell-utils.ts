import type { ChatMessage } from "@/lib/chat-types";

export function streamHasLiveAudio(stream: MediaStream | null): boolean {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));
}

export function channelTitle(
  activeChannel: { type: string; name: string; slug: string | null } | null,
  activeChannelId: number | null,
): string {
  if (!activeChannel) {
    return activeChannelId != null ? "" : "Select a channel";
  }
  if (activeChannel.type === "dm") return activeChannel.name;
  return activeChannel.slug ?? activeChannel.name;
}

export function threadBarLabel(root: ChatMessage): string {
  const n = root.threadReplyCount ?? 0;
  if (n > 0) return `Thread · ${n === 1 ? "1 reply" : `${n} replies`}`;
  return "Thread · No replies yet";
}

export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}
