import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_STARTED_A_NEW_CONVERSATION } from "@/lib/notify-messages";
import { cn } from "@/lib/utils";
import { fetchAgentMailConfig } from "@/lib/agentmail-api";
import { emailAssistantComposeTask } from "@/lib/email-assistant-api";
import type { AgentMailReplyAttachment } from "@/lib/agentmail-api";
import { fetchEmailAgentProgress, type EmailAgentProgress } from "@/lib/email-agent-api";

const THREAD_STORAGE_KEY = "flowbie-chat-thread-id";
const SENDER_EMAIL_STORAGE_KEY = "flowbie-chat-sender-email";
/** Cap total body size sent to the pipeline (characters). */
const MAX_BODY_CHARS = 12000;
/** Max prior turns to include in the history appendix. */
const MAX_HISTORY_TURNS = 20;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  html?: string;
  attachments?: AgentMailReplyAttachment[];
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getOrCreateThreadId(): string {
  try {
    let t = localStorage.getItem(THREAD_STORAGE_KEY);
    if (!t?.trim()) {
      t = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(THREAD_STORAGE_KEY, t);
    }
    return t.trim();
  } catch {
    return `chat-${Date.now()}`;
  }
}

function buildComposeBody(latestUserText: string, priorMessages: ChatMessage[]): string {
  const recent = priorMessages.slice(-MAX_HISTORY_TURNS * 2);
  let appendix = "";
  if (recent.length > 0) {
    const lines = recent.map((m) => {
      const label = m.role === "user" ? "User" : "Assistant";
      const body = m.text.trim() || "(empty)";
      return `${label}: ${body}`;
    });
    appendix = `\n\n--- Conversation history ---\n${lines.join("\n\n")}`;
  }
  const combined = `${latestUserText.trim()}${appendix}`;
  if (combined.length <= MAX_BODY_CHARS) return combined;
  const head = latestUserText.trim().slice(0, Math.min(latestUserText.length, MAX_BODY_CHARS - 500));
  const tail = appendix.slice(Math.max(0, appendix.length - (MAX_BODY_CHARS - head.length - 80)));
  return `${head}\n\n[…history truncated…]\n${tail}`.slice(0, MAX_BODY_CHARS);
}

const assistantBodyClass = cn(
  "prose prose-invert max-w-none text-sm leading-relaxed text-white/80",
  "[&_p]:text-white/80 [&_span]:text-white/80 [&_div]:text-white/80 [&_li]:text-white/80",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:text-white/80",
  "[&_th]:border [&_td]:border [&_th]:border-white/25 [&_td]:border-white/15 [&_th]:bg-white/5 [&_th]:px-2 [&_td]:px-2 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:align-top [&_td]:align-top [&_th]:text-left [&_td]:text-left",
  "[&_a]:break-all [&_a]:text-sky-300 [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"
);

function AssistantBody({ html, text }: { html?: string; text: string }) {
  const trimmedHtml = (html || "").trim();
  if (trimmedHtml) {
    return (
      <div className={assistantBodyClass} dangerouslySetInnerHTML={{ __html: trimmedHtml }} />
    );
  }
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{text}</p>;
}

function downloadAttachment(att: AgentMailReplyAttachment): void {
  try {
    const bin = atob(att.content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.contentType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.filename || "attachment";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "Download failed");
  }
}

function Breadcrumbs() {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-white/55" aria-label="Breadcrumb">
      <span>Dashboard</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      <span>Communication</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      <span className="font-medium text-foreground">Chat</span>
    </nav>
  );
}

export function ChatTabContent(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [threadId, setThreadId] = useState("");
  const [sending, setSending] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [inboxRouting, setInboxRouting] = useState("");
  const [agentProgress, setAgentProgress] = useState<EmailAgentProgress | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SENDER_EMAIL_STORAGE_KEY);
      if (s?.trim()) setSenderEmail(s.trim());
    } catch {
      /* ignore */
    }
    setThreadId(getOrCreateThreadId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConfigLoading(true);
      try {
        const c = await fetchAgentMailConfig();
        if (cancelled) return;
        const route = (c.notifyInboxEmail || c.inboxId || "").trim();
        setInboxRouting(route);
      } catch {
        if (!cancelled) setInboxRouting("");
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!sending) {
      setAgentProgress(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await fetchEmailAgentProgress();
        if (!cancelled) setAgentProgress(p);
      } catch {
        if (!cancelled) setAgentProgress(null);
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sending]);

  const persistSender = useCallback((v: string) => {
    setSenderEmail(v);
    try {
      if (v.trim()) localStorage.setItem(SENDER_EMAIL_STORAGE_KEY, v.trim());
      else localStorage.removeItem(SENDER_EMAIL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const startNewConversation = useCallback(() => {
    try {
      const t = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(THREAD_STORAGE_KEY, t);
      setThreadId(t);
    } catch {
      setThreadId(`chat-${Date.now()}`);
    }
    setMessages([]);
    setInput("");
    notify.success(NOTIFY_STARTED_A_NEW_CONVERSATION);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", text };
    const priorForBody = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const subject =
      text.split(/\r?\n/)[0]?.slice(0, 120)?.trim() || "Flo chat";
    const body = buildComposeBody(text, priorForBody);

    try {
      const out = await emailAssistantComposeTask({
        subject,
        body,
        taskSubtype: null,
        senderEmail: senderEmail.trim() || undefined,
        inboxId: inboxRouting || undefined,
        threadId: threadId || undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: out.text,
          ...(out.html?.trim() ? { html: out.html } : {}),
          ...(out.attachments?.length ? { attachments: out.attachments } : {}),
        },
      ]);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Request failed");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, senderEmail, inboxRouting, threadId]);

  const inputClass =
    "min-h-[88px] border-0 bg-secondary/50 text-sm text-foreground placeholder:text-white/35 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <Breadcrumbs />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">
          Same agent as Flo inbox / email: classify, then KWR, meta, blog, or full tool use. Add your email below if
          site-scoped tools need your WordPress profile.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-white/15 bg-transparent text-xs"
          onClick={startNewConversation}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
          New conversation
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_minmax(0,220px)]">
        <div className="space-y-2">
          <Label htmlFor="chat-sender-email" className="text-white/70">
            Your email (optional)
          </Label>
          <Input
            id="chat-sender-email"
            type="email"
            autoComplete="email"
            placeholder="you@agency.com - for site credentials in email-agent profiles"
            value={senderEmail}
            onChange={(e) => persistSender(e.target.value)}
            className="h-9 border-0 bg-secondary/50 text-sm shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0"
          />
        </div>
        <div className="flex flex-col justify-end text-base leading-snug text-white/45">
          {configLoading ? (
            <span>Loading inbox routing…</span>
          ) : inboxRouting ? (
            <span>
              Tool routing inbox:{" "}
              <code className="rounded bg-white/5 px-1 font-mono text-base text-foreground/80">{inboxRouting}</code>
            </span>
          ) : (
            <span>Set AgentMail under Dashboard → API Keys for tool whitelist routing.</span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flowbie-panel-neon flex min-h-[min(420px,55vh)] flex-1 flex-col overflow-hidden bg-background"
        )}
      >
        {sending &&
        agentProgress?.active &&
        ((agentProgress.steps?.length ?? 0) > 0 ||
          (agentProgress.microSteps?.length ?? 0) > 0 ||
          !!agentProgress.activityDetail?.trim()) ? (
          <div className="shrink-0 bg-primary/[0.06] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">
                Email agent
                {agentProgress.classification ? (
                  <span className="ml-2 font-normal normal-case text-white/70">
                    · {agentProgress.classification === "task" ? "Task" : "Reply"}
                  </span>
                ) : null}
              </p>
              {agentProgress.subject ? (
                <p className="max-w-full truncate text-base text-white/50" title={agentProgress.subject}>
                  {agentProgress.subject}
                </p>
              ) : null}
            </div>
            {(() => {
              const steps = agentProgress.steps ?? [];
              const done = steps.filter((s) => s.state === "done").length;
              const running = steps.some((s) => s.state === "running");
              const total = Math.max(steps.length, 1);
              const pct = Math.min(100, Math.round(((done + (running ? 0.5 : 0)) / total) * 100));
              return (
                <div className="mt-2 space-y-2">
                  <Progress value={pct} className="h-2 bg-white/10" />
                  {agentProgress.activityDetail ? (
                    <p className="text-base font-medium leading-snug text-primary/95">
                      {agentProgress.activityDetail}
                    </p>
                  ) : null}
                  {agentProgress.microSteps && agentProgress.microSteps.length > 0 ? (
                    <ol
                      className="max-h-24 list-decimal space-y-0.5 overflow-y-auto pl-4 text-base leading-snug text-white/55"
                      aria-label="Recent tool steps"
                    >
                      {agentProgress.microSteps.slice(-12).map((m, i) => (
                        <li key={`${m.at}-${i}`}>{m.label}</li>
                      ))}
                    </ol>
                  ) : null}
                  <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Task steps">
                    {steps.map((s) => (
                      <li key={s.id} className="flex items-start gap-2 text-base leading-snug text-white/75">
                        {s.state === "done" ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        ) : s.state === "running" ? (
                          <Loader2
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary"
                            aria-hidden
                          />
                        ) : s.state === "error" ? (
                          <span className="text-amber-300" aria-hidden>
                            !
                          </span>
                        ) : (
                          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                        )}
                        <span className={s.state === "running" ? "text-foreground" : ""}>{s.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !sending ? (
            <p className="text-sm text-white/45">Send a message to run the same pipeline as the email agent.</p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[min(100%,42rem)] rounded-lg px-3 py-2.5",
                  m.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "border-0 bg-white/[0.04]"
                )}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                ) : (
                  <>
                    <AssistantBody html={m.html} text={m.text} />
                    {m.attachments && m.attachments.length > 0 ? (
                      <ul className="mt-2 space-y-1 pt-2">
                        {m.attachments.map((att) => (
                          <li key={att.filename}>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 text-xs text-sky-300 underline hover:text-sky-200"
                              onClick={() => downloadAttachment(att)}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              {att.filename}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
          {sending ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg border-0 bg-white/[0.04] px-3 py-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Working…
              </div>
            </div>
          ) : null}
          <div ref={listEndRef} />
        </div>

        <div className="shrink-0 p-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Flo…"
            className={inputClass}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              className="gap-2 bg-white font-semibold text-black hover:bg-white/90"
              disabled={sending || !input.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
