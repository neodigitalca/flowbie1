import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTeam } from "@/contexts/TeamContext";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

const FORGE_FIELD_TRIGGER =
  "h-9 w-full min-w-0 border-0 bg-black text-white text-base font-medium shadow-none ring-0 outline-none focus:ring-2 focus:ring-primary/45 focus:ring-offset-0 focus-within:ring-2 focus-within:ring-primary/45 focus-within:ring-offset-0 [&>span]:text-white";
const FORGE_FIELD_INPUT =
  "min-h-9 w-full min-w-0 border-0 bg-black text-white text-base font-medium shadow-none ring-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0";
const FORGE_CUSTOM_INLINE_INPUT =
  "h-9 min-h-0 min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-base text-white shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0";
const FORGE_RECIPIENT_MENU =
  "z-[200] border-0 bg-zinc-900 text-white shadow-xl";
const FORGE_RECIPIENT_MENU_ITEM =
  "text-base focus:bg-zinc-800 focus:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white";

const CUSTOM_RECIPIENT = "__custom__";

export type AutomationEmailDeliveryFieldsProps = {
  payload: TaskExecutionPayload;
  disabled?: boolean;
  onChange: (patch: Partial<TaskExecutionPayload>) => void;
};

export function AutomationEmailDeliveryFields({
  payload,
  disabled = false,
  onChange,
}: AutomationEmailDeliveryFieldsProps): React.ReactElement {
  const { members } = useTeam();

  const teamRecipients = useMemo(() => {
    const seen = new Set<string>();
    const rows: { email: string; label: string }[] = [];
    for (const member of members) {
      if (isNeoPulseBotMember(member)) continue;
      const email = member.email?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const name = member.displayName?.trim();
      rows.push({
        email,
        label: name ? `${name} (${email})` : email,
      });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [members]);

  const recipientEmail = (payload.automationEmailTo ?? "").trim();
  const matchedRecipient = useMemo(
    () => teamRecipients.find((row) => row.email.toLowerCase() === recipientEmail.toLowerCase()),
    [recipientEmail, teamRecipients],
  );

  const [customMode, setCustomMode] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recipientEmail) {
      setCustomMode(false);
      return;
    }
    setCustomMode(!matchedRecipient);
  }, [matchedRecipient, recipientEmail]);

  useEffect(() => {
    if (!customMode) return;
    customInputRef.current?.focus();
  }, [customMode]);

  const selectValue = matchedRecipient?.email ?? "";

  const pickTeamRecipient = (email: string) => {
    setCustomMode(false);
    onChange({ automationEmailTo: email });
  };

  const pickCustomRecipient = () => {
    setCustomMode(true);
    if (matchedRecipient) onChange({ automationEmailTo: "" });
  };

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="min-w-0">
        <Label htmlFor="automation-email-to" className="mb-1 block text-base text-muted-foreground">
          To
        </Label>
        {customMode ? (
          <div className={cn(FORGE_FIELD_TRIGGER, "flex items-center px-0")}>
            <Input
              ref={customInputRef}
              id="automation-email-to"
              type="email"
              className={FORGE_CUSTOM_INLINE_INPUT}
              placeholder="lead@company.com"
              value={payload.automationEmailTo ?? ""}
              disabled={disabled}
              aria-label="Custom email recipient"
              onChange={(event) => onChange({ automationEmailTo: event.target.value })}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center text-white disabled:opacity-50"
                  disabled={disabled}
                  aria-label="Choose team member"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={FORGE_RECIPIENT_MENU}>
                {teamRecipients.map((row) => (
                  <DropdownMenuItem
                    key={row.email}
                    className={FORGE_RECIPIENT_MENU_ITEM}
                    onSelect={() => pickTeamRecipient(row.email)}
                  >
                    {row.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Select
            value={selectValue || undefined}
            onValueChange={(next) => {
              if (next === CUSTOM_RECIPIENT) {
                pickCustomRecipient();
                return;
              }
              pickTeamRecipient(next);
            }}
            disabled={disabled}
          >
            <SelectTrigger id="automation-email-to" className={FORGE_FIELD_TRIGGER} aria-label="Email recipient">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent className={FORGE_RECIPIENT_MENU}>
              {teamRecipients.map((row) => (
                <SelectItem key={row.email} value={row.email} className={FORGE_RECIPIENT_MENU_ITEM}>
                  {row.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_RECIPIENT} className={FORGE_RECIPIENT_MENU_ITEM}>
                Custom email
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="min-w-0">
        <Label htmlFor="automation-email-subject" className="mb-1 block text-base text-muted-foreground">
          Subject
        </Label>
        <Input
          id="automation-email-subject"
          className={FORGE_FIELD_INPUT}
          placeholder="{siteName} automation summary ({date})"
          value={payload.automationEmailSubject ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ automationEmailSubject: event.target.value })}
        />
      </div>
      <div className="min-w-0">
        <Label htmlFor="automation-email-message" className="mb-1 block text-base text-muted-foreground">
          Message
        </Label>
        <Textarea
          id="automation-email-message"
          className={`${FORGE_FIELD_INPUT} min-h-[4.5rem] resize-y`}
          placeholder="Hi, your {automationTitle} run for {siteName} is complete."
          value={payload.automationEmailMessage ?? ""}
          disabled={disabled || payload.automationEmailAiIntro === true}
          onChange={(event) => onChange({ automationEmailMessage: event.target.value })}
        />
      </div>
      <div className="flex items-center justify-between gap-3 py-0.5">
        <Label htmlFor="automation-email-ai-intro" className="text-base text-white">
          Talking script for highlights
        </Label>
        <Switch
          id="automation-email-ai-intro"
          checked={payload.automationEmailAiIntro === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ automationEmailAiIntro: checked })}
        />
      </div>
    </div>
  );
}
