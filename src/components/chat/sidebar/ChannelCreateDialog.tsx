import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { addChatChannelMembers, createChatChannel } from "@/lib/chat-api";
import type { ChatChannel } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

export type ChannelCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channel: ChatChannel) => void;
};

export function ChannelCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ChannelCreateDialogProps): React.ReactElement {
  const { user } = useAuth();
  const { activeTeam, members } = useTeam();
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMember = (userId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleCreate = async () => {
    if (!activeTeam || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createChatChannel(activeTeam.id, {
        name: name.trim(),
        type,
        memberUserIds: type === "private" ? selectedMemberIds : undefined,
      });
      if (result.ok && result.channel) {
        if (type === "private" && selectedMemberIds.length > 0) {
          await addChatChannelMembers(activeTeam.id, result.channel.id, selectedMemberIds);
        }
        onCreated(result.channel);
        setName("");
        setType("public");
        setSelectedMemberIds([]);
        onOpenChange(false);
      } else {
        setError(result.error ?? "Could not create channel");
      }
    } finally {
      setBusy(false);
    }
  };

  const inviteMembers = members.filter((m) => m.userId !== user?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle className="text-base">New channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name" className="text-base">
              Name
            </Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="project-updates"
              className="text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Visibility</Label>
            <Select value={type} onValueChange={(v) => setType(v as "public" | "private")}>
              <SelectTrigger className="text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public" className="text-base">
                  Public
                </SelectItem>
                <SelectItem value="private" className="text-base">
                  Private
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "private" ? (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              <Label className="text-base">Members</Label>
              {inviteMembers.map((member) => {
                const selected = selectedMemberIds.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => toggleMember(member.userId)}
                    className={cn(
                      "flex w-full flex-col rounded px-3 py-2 text-left transition-colors",
                      selected ? "bg-zinc-800" : "hover:bg-zinc-900",
                    )}
                  >
                    <span className="text-base text-white">{member.displayName}</span>
                    <span className="text-base text-white/50">{member.email}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {error ? <p className="text-base text-red-400">{error}</p> : null}
          <Button type="button" className="w-full text-base" disabled={busy || !name.trim()} onClick={() => void handleCreate()}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
