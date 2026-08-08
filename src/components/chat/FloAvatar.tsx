import React from "react";
import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FLO_DISPLAY_NAME } from "@/lib/chat-flo";

export type FloAvatarProps = {
  avatarUrl?: string | null;
  displayName?: string;
  className?: string;
};

export function isFloDisplayName(displayName: string): boolean {
  return displayName.trim().toUpperCase() === FLO_DISPLAY_NAME;
}

export function FloAvatar({ avatarUrl, displayName, className }: FloAvatarProps): React.ReactElement {
  return (
    <Avatar className={cn("h-9 w-9 shrink-0", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName ?? FLO_DISPLAY_NAME} /> : null}
      <AvatarFallback className="bg-zinc-800 text-lime-400">
        <Sparkles className="h-4 w-4" aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}
