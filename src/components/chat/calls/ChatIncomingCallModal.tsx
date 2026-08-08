import React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatCall } from "@/lib/chat-call-types";

export type ChatIncomingCallModalProps = {
  call: ChatCall | null;
  callerDisplayName: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function ChatIncomingCallModal({
  call,
  callerDisplayName,
  onAccept,
  onDecline,
}: ChatIncomingCallModalProps): React.ReactElement {
  return (
    <Dialog open={call != null} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-white">Incoming call</DialogTitle>
        </DialogHeader>
        <p className="text-base text-white/80">{callerDisplayName} is calling you</p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-base text-white hover:bg-zinc-800"
            onClick={onDecline}
          >
            <PhoneOff className="h-4 w-4" />
            Decline
          </Button>
          <Button type="button" className="gap-2 text-base" onClick={onAccept}>
            <Phone className="h-4 w-4" />
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
