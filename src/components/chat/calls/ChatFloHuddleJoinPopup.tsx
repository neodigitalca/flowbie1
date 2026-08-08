import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloAvatar } from "@/components/chat/FloAvatar";
import type { ActiveHuddleSummary } from "@/lib/chat-call-types";

export type ChatFloHuddleJoinPopupProps = {
  open: boolean;
  channelLabel: string;
  huddle: ActiveHuddleSummary | null;
  participantNames: string[];
  onJoin: () => void;
  onDismiss: () => void;
};

export function ChatFloHuddleJoinPopup({
  open,
  channelLabel,
  huddle,
  participantNames,
  onJoin,
  onDismiss,
}: ChatFloHuddleJoinPopupProps): React.ReactElement {
  const count = huddle?.participantCount ?? participantNames.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent className="bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-white">Join huddle in {channelLabel}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-base text-white/70">
            {count} {count === 1 ? "person is" : "people are"} in a huddle with FLO.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <FloAvatar className="h-10 w-10" />
            {participantNames.slice(0, 6).map((name) => (
              <span key={name} className="rounded-full bg-zinc-800 px-3 py-1 text-base text-white">
                {name}
              </span>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="text-base text-white" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button type="button" className="text-base" onClick={onJoin}>
              Join
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
