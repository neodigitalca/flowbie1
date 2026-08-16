export type SupportTicketStatus = "open" | "closed";

export type SupportTicketSource = "pulse-assist";

export type SupportTicketCreator = {
  userId: number;
  displayName: string;
  email: string;
};

export type SupportTicketWorkspace = {
  managerTab?: string;
  siteName?: string;
  url?: string;
  deployGitSha?: string;
  submode?: string;
  targetScope?: string;
};

export type SupportComment = {
  id: number;
  ticketId: number;
  userId: number;
  displayName: string;
  body: string;
  createdAt: string;
};

export type SupportTicket = {
  id: number;
  teamId: number;
  title: string;
  summary: string;
  status: SupportTicketStatus;
  source: SupportTicketSource | string;
  hasChatLog: boolean;
  workspace: SupportTicketWorkspace;
  createdBy: SupportTicketCreator;
  createdAt: string;
  updatedAt: string;
  comments?: SupportComment[];
};

export type SupportTicketExportBundle = {
  exportedAt: string;
  team: { id: number; name: string; slug: string };
  ticketCount: number;
  tickets: SupportTicket[];
};

export type CreateSupportTicketPayload = {
  title?: string;
  summary?: string;
  comment?: string;
  source?: SupportTicketSource;
  chatLog?: Record<string, unknown>;
  workspace?: SupportTicketWorkspace;
  openRouterApiKey?: string;
};

export type PreviewSupportTicketAiPayload = {
  chatLog?: Record<string, unknown>;
  comment?: string;
  openRouterApiKey?: string;
};
