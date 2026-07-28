import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  Inbox,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Settings,
} from "lucide-react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COPY_FAILED, NOTIFY_INBOX_ADDRESS_COPIED, NOTIFY_MESSAGE_SENT, NOTIFY_TO_SUBJECT_AND_MESSAGE_BODY_ARE_REQUIRED } from "@/lib/notify-messages";
import { format, isValid, parseISO } from "date-fns";
import {
  fetchAgentMailConfig,
  fetchAgentMailMessageDetail,
  fetchAgentMailMessages,
  sendAgentMailMessage,
  type AgentMailMessageDetail,
  type AgentMailMessageRow,
} from "@/lib/agentmail-api";
import { loadAgentMailGeneralEmail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fetchEmailAgentProgress, type EmailAgentProgress } from "@/lib/email-agent-api";
import { getEmailMessagePreviewHtml } from "@/lib/email-agent-thread-utils";
import { Progress } from "@/components/ui/progress";

const FORM_ID = "communication-tab";
const COMPOSE_ANCHOR_ID = "communication-compose";

type ActiveView = "inbox" | "setup";

export type CommunicationTabContentProps = Record<string, never>;

const iconSm = "h-4 w-4 shrink-0 stroke-[1.5]";

function formatMessageTime(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = parseISO(ts);
    return isValid(d) ? format(d, "MMM d · HH:mm") : ts;
  } catch {
    return ts;
  }
}

function normalizeRow(m: Record<string, unknown>): AgentMailMessageRow {
  return {
    messageId: typeof m.messageId === "string" ? m.messageId : undefined,
    subject: typeof m.subject === "string" ? m.subject : undefined,
    from: typeof m.from === "string" ? m.from : undefined,
    preview: typeof m.preview === "string" ? m.preview : undefined,
    timestamp: typeof m.timestamp === "string" ? m.timestamp : undefined,
  };
}

const communicationMessageBodyClass = cn(
  "email-message-preview prose prose-invert max-w-none text-sm leading-relaxed text-white/80",
  "[&_p]:text-white/80 [&_span]:text-white/80 [&_div]:text-white/80 [&_li]:text-white/80",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:text-white/80",
  "[&_th]:border [&_td]:border [&_th]:border-white/25 [&_td]:border-white/15 [&_th]:bg-white/5 [&_th]:px-2 [&_td]:px-2 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:align-top [&_td]:align-top [&_th]:text-left [&_td]:text-left",
  "[&_a]:break-all [&_a]:text-sky-300 [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"
);

function CommunicationMessageBody({ detail }: { detail: AgentMailMessageDetail }) {
  const previewHtml = getEmailMessagePreviewHtml(detail).trim();
  if (!previewHtml) {
    return (
      <div className={communicationMessageBodyClass}>
        <span className="text-white/45">(No body text)</span>
      </div>
    );
  }
  return <div className={communicationMessageBodyClass} dangerouslySetInnerHTML={{ __html: previewHtml }} />;
}

function Breadcrumbs() {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-white/55" aria-label="Breadcrumb">
      <span>Dashboard</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      <span>Communication</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      <span className="font-medium text-foreground">Unified Inbox</span>
    </nav>
  );
}

/**
 * Flo / AgentMail inbox: read and send (shared across all properties).
 * Top-level Communication tab - not tied to a single WordPress site.
 */
export const CommunicationTabContent: React.FC<CommunicationTabContentProps> = () => {
  const [activeView, setActiveView] = useState<ActiveView>("inbox");
  const composeAnchorRef = useRef<HTMLDivElement>(null);

  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState("");
  const [displayName, setDisplayName] = useState("Communication");
  const [notifyInboxEmail, setNotifyInboxEmail] = useState(
    import.meta.env.DEV ? "seowithflo@agentmail.to" : "flowbie@agentmail.to",
  );
  const [outboundReplyTo, setOutboundReplyTo] = useState<string | undefined>();
  const [configured, setConfigured] = useState(false);

  const [listLoading, setListLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMailMessageRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<AgentMailMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [to, setTo] = useState(() => loadAgentMailGeneralEmail());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [agentProgress, setAgentProgress] = useState<EmailAgentProgress | null>(null);

  const scrollToCompose = useCallback(() => {
    setActiveView("inbox");
    setSelectedMessageId(null);
    setMessageDetail(null);
    window.requestAnimationFrame(() => {
      composeAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = document.getElementById(`agentmail-to-${FORM_ID}`);
      first?.focus();
    });
  }, []);

  const loadMessageDetail = useCallback(
    async (messageId: string) => {
      if (!inboxId) return;
      setDetailLoading(true);
      setMessageDetail(null);
      try {
        const detail = await fetchAgentMailMessageDetail({
          inboxId: inboxId,
          messageId,
        });
        setMessageDetail(detail);
      } catch (e) {
        notify.error(e instanceof Error ? e.message : "Could not load message");
        setSelectedMessageId(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [inboxId]
  );

  const handleSelectMessage = useCallback(
    (messageId: string | undefined): void => {
      if (!messageId) return;
      setSelectedMessageId(messageId);
      void loadMessageDetail(messageId);
    },
    [loadMessageDetail]
  );

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const c = await fetchAgentMailConfig();
      setInboxId(c.inboxId);
      setDisplayName(c.displayName);
      setConfigured(c.configured);
      if (c.generalEmail?.trim()) {
        setTo(c.generalEmail.trim());
      } else if (!to.trim()) {
        setTo(loadAgentMailGeneralEmail());
      }
      if (c.notifyInboxEmail?.trim()) {
        setNotifyInboxEmail(c.notifyInboxEmail.trim());
      }
      setOutboundReplyTo(c.outboundReplyTo?.trim() || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load email settings";
      setConfigError(msg);
      setConfigured(false);
      notify.error(msg);
    } finally {
      setConfigLoading(false);
    }
  }, [to]);

  const loadMessages = useCallback(async (opts?: { pageToken?: string; append?: boolean }) => {
    setListLoading(true);
    try {
      const data = await fetchAgentMailMessages({
        limit: 20,
        pageToken: opts?.pageToken,
      });
      const rows = (data.messages || []).map((m) =>
        normalizeRow(m as Record<string, unknown>)
      );
      setMessages((prev) => (opts?.append ? [...prev, ...rows] : rows));
      setNextPageToken(data.nextPageToken);
      if (!opts?.append) {
        setSelectedMessageId(null);
        setMessageDetail(null);
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not load messages");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!configLoading && configured) {
      void loadMessages();
    }
  }, [configLoading, configured, loadMessages]);

  useEffect(() => {
    if (!configured || activeView !== "inbox") {
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
  }, [configured, activeView]);

  const copyInbox = useCallback(() => {
    if (!inboxId) return;
    void navigator.clipboard.writeText(inboxId).then(
      () => notify.success(NOTIFY_INBOX_ADDRESS_COPIED),
      () => notify.error(NOTIFY_COPY_FAILED)
    );
  }, [inboxId]);

  const handleSend = useCallback(async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      notify.error(NOTIFY_TO_SUBJECT_AND_MESSAGE_BODY_ARE_REQUIRED);
      return;
    }
    setSending(true);
    try {
      await sendAgentMailMessage({
        to: to.trim(),
        subject: subject.trim(),
        text: body.trim(),
      });
      notify.success(NOTIFY_MESSAGE_SENT);
      setTo(loadAgentMailGeneralEmail());
      setSubject("");
      setBody("");
      void loadMessages();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [to, subject, body, loadMessages]);

  const loadMore = useCallback(() => {
    if (!nextPageToken || listLoading) return;
    void loadMessages({ pageToken: nextPageToken, append: true });
  }, [nextPageToken, listLoading, loadMessages]);

  const inputClass =
    "h-9 border-0 bg-secondary/50 text-sm text-foreground placeholder:text-white/35 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0";

  const navRowClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
      "text-foreground/90 hover:bg-white/[0.06]",
      active && "bg-white/[0.05] text-foreground"
    );

  if (configLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs />
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <Breadcrumbs />

      <div
        className={cn(
          "flowbie-panel-neon flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background md:flex-row"
        )}
      >
        {/* Sidebar */}
        <aside
          className="flex w-full shrink-0 flex-col gap-4 p-4 md:w-60"
          aria-label="Inbox navigation"
        >
          <Button
            type="button"
            className="h-10 w-full gap-2 bg-white font-semibold text-black hover:bg-white/90"
            onClick={scrollToCompose}
          >
            <Pencil className={cn(iconSm, "text-black")} aria-hidden />
            Compose
          </Button>

          <nav className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setActiveView("inbox")}
              className={navRowClass(activeView === "inbox")}
              aria-current={activeView === "inbox" ? "page" : undefined}
            >
              <Inbox className={iconSm} aria-hidden />
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setActiveView("setup")}
              className={navRowClass(activeView === "setup")}
              aria-current={activeView === "setup" ? "page" : undefined}
            >
              <Settings className={iconSm} aria-hidden />
              Settings
            </button>
          </nav>
        </aside>

        {/* Main */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeView === "setup" ? (
            <div className="space-y-4 p-4 md:p-6">
              <div className="flex items-center gap-3 pb-4">
                <KeyRound className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <h2 className="text-base font-semibold text-foreground">AgentMail connection</h2>
              </div>
              {!configured ? (
                <p className="text-sm leading-relaxed text-white/60">
                  Add your AgentMail key under <strong className="text-foreground/90">Dashboard → API Keys</strong>, or
                  set{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-base">AGENTMAIL_API_KEY</code> on
                  the API server.
                </p>
              ) : (
                <p className="text-sm text-white/60">AgentMail is configured.</p>
              )}
              {configured && outboundReplyTo ? (
                <p className="text-xs leading-relaxed text-white/50">
                  Outbound Reply-To:{" "}
                  <code className="rounded bg-white/5 px-1 font-mono text-base text-foreground/85">
                    {outboundReplyTo}
                  </code>{" "}
                  (recipients’ mail clients use this for Reply; From stays the AgentMail inbox.)
                </p>
              ) : null}
              {configError ? (
                <p className="text-sm leading-relaxed text-amber-200/90">
                  {configError}. Check API is running and you are logged in (use the Vite dev URL so /api/agentmail is
                  proxied).
                </p>
              ) : null}
              <p className="text-xs text-white/50">
                Manage WordPress sites under <strong className="text-foreground/80">Dashboard → Properties</strong>.
              </p>
              <p className="text-xs text-white/50">
                Notify inbox (<code className="rounded bg-white/5 px-1 font-mono">{notifyInboxEmail}</code>): for{" "}
                <strong className="text-foreground/80">thread view + auto-reply</strong>, open{" "}
                <strong className="text-foreground/80">Dashboard → Properties</strong>, expand a site, then{" "}
                <strong className="text-foreground/80">Email</strong>. For chat-style polling here, turn on{" "}
                <strong className="text-foreground/80">Email</strong> in <strong className="text-foreground/80">Free Flow</strong>{" "}
                → Flowbie Assist while this app is open.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Top: shared inbox identity */}
              <div className="shrink-0 px-4 py-3 md:px-6">
                <p className="text-xs font-medium uppercase tracking-wide text-white/45">Flo · {displayName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-foreground/90">
                    {inboxId || " - "}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-0 bg-transparent text-xs shadow-none"
                    disabled={!inboxId}
                    onClick={copyInbox}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <span className="w-full text-xs text-white/45 md:w-auto">
                    Shared inbox - mention a property in the subject if needed.
                  </span>
                  {outboundReplyTo ? (
                    <span className="w-full text-xs text-white/40 md:w-auto">
                      Reply-To on send:{" "}
                      <code className="rounded bg-white/5 px-1 font-mono text-base">{outboundReplyTo}</code>
                    </span>
                  ) : null}
                </div>
              </div>

              {!configured ? (
                <p className="px-4 py-3 text-sm text-white/55 md:px-6">
                  Add your AgentMail key under Dashboard → API Keys to load messages.
                </p>
              ) : null}
              {configError ? (
                <p className="px-4 py-2 text-sm text-amber-200/90 md:px-6">{configError}</p>
              ) : null}

              {agentProgress?.active &&
              ((agentProgress.steps?.length ?? 0) > 0 ||
                (agentProgress.microSteps?.length ?? 0) > 0 ||
                !!agentProgress.activityDetail?.trim()) ? (
                <div className="shrink-0 bg-primary/[0.06] px-4 py-3 md:px-6">
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
                    const pct = Math.min(
                      100,
                      Math.round(((done + (running ? 0.5 : 0)) / total) * 100)
                    );
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
                            className="max-h-28 list-decimal space-y-0.5 overflow-y-auto pl-4 text-base leading-snug text-white/55"
                            aria-label="Recent tool steps"
                          >
                            {agentProgress.microSteps.slice(-12).map((m, i) => (
                              <li key={`${m.at}-${i}`}>{m.label}</li>
                            ))}
                          </ol>
                        ) : null}
                        <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Task steps">
                          {steps.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-start gap-2 text-base leading-snug text-white/75"
                            >
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

              {/* Split: message list | preview + compose */}
              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* Side panel: messages */}
                <aside
                  className="flex min-h-[220px] shrink-0 flex-col md:w-[min(100%,320px)]"
                  aria-label="Message list"
                >
                  <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Messages</p>
                      <p className="truncate text-base text-white/40">
                        {listLoading && messages.length === 0
                          ? "Loading…"
                          : `${messages.length} thread${messages.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-foreground"
                      disabled={!configured || listLoading}
                      onClick={() => void loadMessages()}
                      aria-label="Refresh messages"
                    >
                      {listLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 stroke-[1.5]" />
                      )}
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {listLoading && messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-12 text-white/55">
                        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                        <p className="text-sm">Loading…</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-3 py-12 text-center">
                        <p className="text-sm text-white/55">No threads found</p>
                      </div>
                    ) : (
                      <ul className="">
                        {messages.map((m, idx) => {
                          const mid = m.messageId;
                          const active = Boolean(mid && selectedMessageId === mid);
                          return (
                            <li key={mid || `${idx}-${m.timestamp || ""}`}>
                              <button
                                type="button"
                                disabled={!mid}
                                onClick={() => handleSelectMessage(mid)}
                                className={cn(
                                  "w-full px-3 py-3 text-left transition-colors",
                                  "hover:bg-white/[0.04]",
                                  active && "bg-primary/10"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                    {m.subject?.trim() || "(no subject)"}
                                  </span>
                                  <time
                                    className="shrink-0 font-mono text-base text-white/45"
                                    dateTime={m.timestamp}
                                  >
                                    {formatMessageTime(m.timestamp)}
                                  </time>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-white/50">{m.from || " - "}</p>
                                {m.preview ? (
                                  <p className="mt-0.5 line-clamp-2 text-base leading-snug text-white/40">
                                    {m.preview}
                                  </p>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {nextPageToken ? (
                    <div className="shrink-0 p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-0 bg-transparent text-xs shadow-none"
                        disabled={listLoading}
                        onClick={loadMore}
                      >
                        {listLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </aside>

                {/* Main: read + compose */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {selectedMessageId ? (
                      <div className="p-4 md:p-6">
                        {detailLoading ? (
                          <div className="flex items-center gap-2 text-sm text-white/55">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading message…
                          </div>
                        ) : messageDetail ? (
                          <div className="space-y-3">
                            <header className="space-y-1 pb-3">
                              <h2 className="text-base font-semibold text-foreground leading-snug">
                                {messageDetail.subject?.trim() || "(no subject)"}
                              </h2>
                              <p className="text-xs text-white/50">
                                <span className="text-white/40">From </span>
                                {messageDetail.from || " - "}
                              </p>
                              {messageDetail.timestamp ? (
                                <p className="font-mono text-base text-white/40">
                                  {formatMessageTime(messageDetail.timestamp)}
                                </p>
                              ) : null}
                            </header>
                            <CommunicationMessageBody detail={messageDetail} />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] flex-col items-center justify-center px-3 py-12 text-center">
                        <Inbox className="mb-2 h-10 w-10 text-white/20" aria-hidden />
                        <p className="text-sm font-medium text-white/55">Select a message</p>
                        <p className="mt-1 max-w-xs text-xs text-white/40">
                          Choose a thread in the list to read it here, or use Compose to write a new message.
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    ref={composeAnchorRef}
                    id={COMPOSE_ANCHOR_ID}
                    className="shrink-0 bg-background p-4 md:p-6"
                  >
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/45">New message</h3>
                    <div className="flex flex-col gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`agentmail-to-${FORM_ID}`} className="text-xs text-white/50">
                          To
                        </Label>
                        <Input
                          id={`agentmail-to-${FORM_ID}`}
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          autoComplete="email"
                          disabled={!configured || sending}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`agentmail-subject-${FORM_ID}`} className="text-xs text-white/50">
                          Subject
                        </Label>
                        <Input
                          id={`agentmail-subject-${FORM_ID}`}
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          disabled={!configured || sending}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`agentmail-body-${FORM_ID}`} className="text-xs text-white/50">
                          Message
                        </Label>
                        <Textarea
                          id={`agentmail-body-${FORM_ID}`}
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          rows={4}
                          disabled={!configured || sending}
                          className={cn(
                            inputClass,
                            "min-h-[88px] resize-y py-2"
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={!configured || sending}
                        onClick={() => void handleSend()}
                        className="h-9 w-full sm:w-auto"
                      >
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
