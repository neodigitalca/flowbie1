import React from "react";
import { cn } from "@/lib/utils";
import type { MinimalChannelTab } from "@/components/chat/layout/useChatShellState";

type Props = {
  activeTab: MinimalChannelTab;
  onTabChange: (tab: MinimalChannelTab) => void;
};

export function ChatChannelHeaderTabs({ activeTab, onTabChange }: Props): React.ReactElement {
  const tabs: { id: MinimalChannelTab; label: string }[] = [
    { id: "messages", label: "Messages" },
    { id: "files", label: "Files" },
  ];

  return (
    <div className="flex shrink-0 items-center gap-4 px-1" role="tablist" aria-label="Channel views">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "pb-2 text-base font-semibold transition-colors",
            activeTab === tab.id ? "chat-minimal-channel-tab-active" : "chat-minimal-channel-tab-idle",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
