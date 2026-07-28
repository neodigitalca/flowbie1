import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAgentMailConfig,
  fetchAgentMailMessageDetail,
  fetchAgentMailMessages,
  sendAgentMailMessage,
} from "@/lib/agentmail-api";
import { ensureAgentMailReplyBody } from "@/lib/agentmail-reply-body";
import { FLO_EMAIL_REPLY_MAX_BODY_CHARS } from "@/lib/flo-email-reply";
import { emailAssistantComposeTask, resolveToolMailboxForRouting } from "@/lib/email-assistant-api";

const POLL_MS = 50_000;
const PROCESSED_STORAGE_KEY = "flowbie-email-assistant-processed";
const MAX_BODY_CHARS = FLO_EMAIL_REPLY_MAX_BODY_CHARS;

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function extractInboundSenderEmail(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  const raw = m ? m[1] : from;
  const match = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return match ? normalizeEmail(match[0]) : null;
}

function loadProcessedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(PROCESSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveProcessedIds(ids: Set<string>) {
  const arr = [...ids];
  const max = 2000;
  sessionStorage.setItem(PROCESSED_STORAGE_KEY, JSON.stringify(arr.slice(-max)));
}

type UseEmailAssistantPollArgs = {
  enabled: boolean;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  appendVisibleMessage: (role: "user" | "assistant", content: string) => void;
};

export function useEmailAssistantPoll({
  enabled,
  apiKey,
  temperature,
  maxTokens,
  topP,
  appendVisibleMessage,
}: UseEmailAssistantPollArgs) {
  const [status, setStatus] = useState<{
    lastPollAt: number | null;
    lastError: string | null;
    lastReplySummary: string | null;
  }>({ lastPollAt: null, lastError: null, lastReplySummary: null });

  const processedRef = useRef<Set<string>>(loadProcessedIds());
  const inFlightRef = useRef(false);

  const tick = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus((s) => ({ ...s, lastError: null }));

    try {
      const config = await fetchAgentMailConfig();
      if (!config.configured) {
        setStatus((s) => ({
          ...s,
          lastPollAt: Date.now(),
          lastError: "AgentMail not configured (API keys).",
        }));
        return;
      }

      const notifyInbox = (config.notifyInboxEmail || "").trim();
      const routingInbox = resolveToolMailboxForRouting(
        notifyInbox,
        config.toolMailboxEmail
      );
      const primaryInbox = (config.inboxId || "").trim();
      if (!notifyInbox) {
        setStatus((s) => ({
          ...s,
          lastPollAt: Date.now(),
          lastError: "AgentMail notify inbox address missing from config.",
        }));
        return;
      }

      const list = await fetchAgentMailMessages({
        inboxId: notifyInbox,
        limit: 30,
      });
      const rows = list.messages || [];

      for (const row of rows) {
        const messageId = row.messageId?.trim();
        if (!messageId || processedRef.current.has(messageId)) continue;

        const detail = await fetchAgentMailMessageDetail({
          inboxId: notifyInbox,
          messageId,
        });

        const fromRaw = typeof detail.from === "string" ? detail.from : "";
        const senderEmail = extractInboundSenderEmail(fromRaw);
        if (senderEmail) {
          const isOurMailbox =
            senderEmail === normalizeEmail(notifyInbox) ||
            senderEmail === normalizeEmail(primaryInbox) ||
            senderEmail === routingInbox;
          if (isOurMailbox) {
            processedRef.current.add(messageId);
            saveProcessedIds(processedRef.current);
            continue;
          }
        }

        const bodyText =
          (typeof detail.extractedText === "string" && detail.extractedText.trim()
            ? detail.extractedText
            : typeof detail.text === "string"
              ? detail.text
              : "") ||
          (typeof detail.preview === "string" ? detail.preview : "") ||
          "";

        const truncated =
          bodyText.length > MAX_BODY_CHARS ? `${bodyText.slice(0, MAX_BODY_CHARS)}\n…` : bodyText;

        const subjectLine = (detail.subject || row.subject || "(no subject)").trim();

        const composed = await emailAssistantComposeTask({
          subject: subjectLine,
          body: truncated || "",
          taskSubtype: null,
          openRouterApiKey: apiKey,
          inboxId: routingInbox,
          ...(senderEmail ? { senderEmail } : {}),
          ...(fromRaw.trim() ? { fromEmail: fromRaw.trim() } : {}),
        });
        const ensured = ensureAgentMailReplyBody(composed);
        const replyBody = ensured.text;
        const replyHtml = ensured.html;
        const attachments = composed.attachments?.length ? composed.attachments : undefined;

        await sendAgentMailMessage({
          replyToMessageId: messageId,
          inboxId: notifyInbox,
          text: replyBody,
          ...(replyHtml ? { html: replyHtml } : {}),
          ...(attachments?.length ? { attachments } : {}),
        });

        processedRef.current.add(messageId);
        saveProcessedIds(processedRef.current);

        const summary = `Auto-replied to ${senderEmail || fromRaw} - ${(detail.subject || row.subject || "").slice(0, 60) || "(no subject)"}`;
        appendVisibleMessage("assistant", `[Email assistant] ${summary}`);
        setStatus({
          lastPollAt: Date.now(),
          lastError: null,
          lastReplySummary: summary,
        });

        return;
      }

      setStatus((s) => ({ ...s, lastPollAt: Date.now() }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus((s) => ({
        ...s,
        lastPollAt: Date.now(),
        lastError: msg,
      }));
      console.warn("[Email assistant] poll", msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, apiKey, appendVisibleMessage]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    void tick();
    return () => clearInterval(id);
  }, [enabled, tick]);

  return { status };
}
