import type { ChatMessage } from "@/lib/chat-types";

const GROUP_MS = 5 * 60 * 1000;

export type MessageGroup = {
  userId: number;
  displayName: string;
  messages: ChatMessage[];
};

export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameUser = last && last.userId === msg.userId;
    const withinWindow =
      lastMsg &&
      Math.abs(new Date(msg.createdAt).getTime() - new Date(lastMsg.createdAt).getTime()) <= GROUP_MS;
    if (sameUser && withinWindow && last) {
      last.messages.push(msg);
    } else {
      groups.push({ userId: msg.userId, displayName: msg.displayName, messages: [msg] });
    }
  }
  return groups;
}
