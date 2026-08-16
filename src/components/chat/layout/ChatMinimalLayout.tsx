import React from "react";
import { ArrowLeft, Hash, Radio, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "@/components/chat/sidebar/ChatSidebar";
import { ChatMessageList } from "@/components/chat/thread/ChatMessageList";
import { ChatComposer } from "@/components/chat/thread/ChatComposer";
import { ChatThreadPanel } from "@/components/chat/thread/ChatThreadPanel";
import { ChatSharedBrowser } from "@/components/chat/shared/ChatSharedBrowser";
import { ChatPanelResizeHandle } from "@/components/chat/shared/ChatPanelResizeHandle";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatNotificationPermissionPrompt } from "@/components/chat/ChatNotificationPermissionPrompt";
import { ChatHuddleSidebar } from "@/components/chat/calls/ChatHuddleSidebar";
import {
  CHAT_CHANNEL_BAR_CLASS,
  CHAT_CHANNEL_TITLE_CLASS,
  CHAT_SCROLL_CLASS,
  CHAT_TEXT_MUTED,
  CHAT_TEXT_PRIMARY,
  CHAT_INPUT_THEMED_CLASS,
  CHAT_TAB_ACTIVE_CLASS,
  CHAT_ICON_BTN_CLASS,
} from "@/components/chat/chat-theme";
import { channelTitle, threadBarLabel, typingLabel } from "@/components/chat/layout/chat-shell-utils";
import type { ChatShellViewModel } from "@/components/chat/layout/useChatShellState";
import { ChatChannelHeaderTabs } from "@/components/chat/slack/ChatChannelHeaderTabs";

type Props = {
  vm: ChatShellViewModel;
};

export function ChatMinimalLayout({ vm }: Props): React.ReactElement {
  const {
    teamId,
    user,
    isTeamAdmin,
    canWrite,
    themePrefs,
    leftZone,
    mainZone,
    rightZone,
    channels,
    liveDisplayMessages,
    activeChannelId,
    activeChannel,
    threadRoot,
    highlightMessageId,
    editingTopic,
    topicDraft,
    messageSearchQuery,
    threadSearchQuery,
    messageSearchActive,
    mentions,
    mentionUnreadCount,
    activeMentionMessageId,
    alerts,
    activeAlertId,
    typingUsers,
    sending,
    isChannelHydrated,
    userSentRef,
    threadUnreadMap,
    mentionMembers,
    members,
    sharedListEpoch,
    activeHuddles,
    minimalChannelTab,
    setMinimalChannelTab,
    starredChannelIds,
    toggleStarredChannel,
    huddleSidebarOpen,
    setHuddleSidebarOpen,
    inFloHuddle,
    showHuddleButton,
    huddleChannelLabel,
    huddleRemoteLabel,
    huddleParticipantAvatars,
    huddleParticipantCount,
    localStream,
    remoteStream,
    callMuted,
    callCameraOff,
    callError,
    micReady,
    peerConnected,
    presenting,
    screenStream,
    noiseCancellationStrength,
    canEditTopic,
    onSelectChannel,
    upsertChannel,
    openThread,
    closeThread,
    handleJumpToMessage,
    handleOpenThreadFromBrowser,
    handleOpenMention,
    handleOpenAlert,
    dismissAlert,
    handleEdit,
    handleDeleteMessage,
    handleAiCorrect,
    handleSend,
    loadThread,
    markThreadRead,
    pingTyping,
    saveTopic,
    setEditingTopic,
    setTopicDraft,
    setMessageSearchQuery,
    setThreadSearchQuery,
    setHighlightMessageId,
    handleEnableDesktopAlerts,
    handleStartHuddle,
    handleLeaveHuddle,
    togglePresent,
    toggleMute,
    toggleCamera,
    handleNoiseCancellationStrengthChange,
    setPersonalizationOpen,
    mainComposerRef,
    threadComposerRef,
  } = vm;

  const showHuddlePanel = inFloHuddle && huddleSidebarOpen;

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId={teamId ? `neo-pulse-chat-minimal-${teamId}` : undefined}
      className="h-full min-h-0 min-w-0 flex-1"
    >
      <ResizablePanel defaultSize={18} minSize={14} maxSize={30} className="min-w-0">
        <ChatSidebar
          layoutMode="minimal"
          channels={channels}
          activeChannelId={activeChannelId}
          canWrite={canWrite}
          onSelectChannel={onSelectChannel}
          onChannelCreated={upsertChannel}
          onDmOpened={upsertChannel}
          mentions={mentions}
          mentionUnreadCount={mentionUnreadCount}
          activeMentionMessageId={activeMentionMessageId}
          onOpenMention={handleOpenMention}
          alerts={alerts}
          activeAlertId={activeAlertId}
          onOpenAlert={handleOpenAlert}
          onDismissAlert={dismissAlert}
          sidebarSections={themePrefs.appearance.sidebarSections}
          activeHuddles={activeHuddles}
          starredChannelIds={starredChannelIds}
          onToggleStarred={toggleStarredChannel}
          zoneClassName={leftZone.className}
          zoneStyle={leftZone.style}
          zoneTheme={leftZone["data-zone-theme"]}
        />
      </ResizablePanel>
      <ChatPanelResizeHandle />
      <ResizablePanel defaultSize={82} minSize={50} className="min-w-0">
        <div
          {...mainZone}
          className={cn(mainZone.className, "flex h-full min-h-0 min-w-0 flex-col overflow-hidden")}
        >
          <div className={cn(CHAT_CHANNEL_BAR_CLASS, "flex-col items-stretch gap-0 px-0 py-0")}>
            <div className="flex shrink-0 items-center gap-2 px-4 py-2">
              {activeChannelId ? (
                threadRoot ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn("h-8 shrink-0 gap-1 px-2 text-base chat-text-muted hover:chat-text-primary")}
                      onClick={closeThread}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to #{channelTitle(activeChannel, activeChannelId)}
                    </Button>
                    <span className={cn("shrink-0 text-base font-bold", CHAT_TEXT_PRIMARY)}>
                      {threadBarLabel(threadRoot)}
                    </span>
                    <div className="ml-auto flex min-w-0 max-w-xs flex-1 items-center justify-end">
                      <Input
                        value={threadSearchQuery}
                        onChange={(e) => setThreadSearchQuery(e.target.value)}
                        placeholder="Search in thread"
                        className={cn("h-8 text-base", CHAT_INPUT_THEMED_CLASS)}
                        aria-label="Search in thread"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {activeChannel && activeChannel.type !== "dm" ? (
                      <Hash className={cn("h-5 w-5 shrink-0", CHAT_TEXT_MUTED)} aria-hidden />
                    ) : null}
                    <h2 className={CHAT_CHANNEL_TITLE_CLASS}>
                      {channelTitle(activeChannel, activeChannelId)}
                    </h2>
                    {activeChannel && activeChannel.type !== "dm" ? (
                      editingTopic && canEditTopic ? (
                        <input
                          value={topicDraft}
                          onChange={(e) => setTopicDraft(e.target.value)}
                          onBlur={() => void saveTopic()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveTopic();
                            if (e.key === "Escape") setEditingTopic(false);
                          }}
                          className={cn("min-w-0 max-w-xs flex-1 bg-transparent text-base outline-none", CHAT_TEXT_MUTED)}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className={cn("min-w-0 truncate text-base", CHAT_TEXT_MUTED)}
                          onClick={() => {
                            if (!canEditTopic || !activeChannel) return;
                            setTopicDraft(activeChannel.topic ?? "");
                            setEditingTopic(true);
                          }}
                        >
                          {activeChannel.topic?.trim() || (canEditTopic ? "Add topic" : "")}
                        </button>
                      )
                    ) : null}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 shrink-0", CHAT_ICON_BTN_CLASS)}
                        aria-label="Chat personalization"
                        onClick={() => setPersonalizationOpen(true)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {inFloHuddle ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-8 shrink-0 gap-1 px-3 text-base",
                            huddleSidebarOpen && CHAT_TAB_ACTIVE_CLASS,
                          )}
                          onClick={() => setHuddleSidebarOpen((open) => !open)}
                        >
                          <Radio className="h-4 w-4" />
                          Huddle
                        </Button>
                      ) : showHuddleButton ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 shrink-0 gap-1 px-3 text-base"
                          onClick={() => void handleStartHuddle()}
                        >
                          <Radio className="h-4 w-4" />
                          Huddle
                        </Button>
                      ) : null}
                      <Input
                        value={messageSearchQuery}
                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                        placeholder="Search messages"
                        className={cn("h-8 w-44 shrink-0 text-base", CHAT_INPUT_THEMED_CLASS)}
                        aria-label="Search messages"
                      />
                      {themePrefs.behavior.showTypingIndicators && typingUsers.length > 0 ? (
                        <span className={cn("hidden truncate text-base italic sm:block", CHAT_TEXT_MUTED)}>
                          {typingLabel(typingUsers.map((u) => u.displayName))}
                        </span>
                      ) : null}
                    </div>
                  </>
                )
              ) : (
                <span className={cn("text-base", CHAT_TEXT_MUTED)}>Select a channel</span>
              )}
            </div>
            {activeChannelId && !threadRoot ? (
              <div className="px-4">
                <ChatChannelHeaderTabs activeTab={minimalChannelTab} onTabChange={setMinimalChannelTab} />
              </div>
            ) : null}
          </div>
          <ChatNotificationPermissionPrompt
            teamId={teamId}
            onEnableDesktopAlerts={handleEnableDesktopAlerts}
          />
          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {minimalChannelTab === "messages" || threadRoot ? (
                <>
                  <div className={cn(CHAT_SCROLL_CLASS, "min-h-0 flex-1 p-0")}>
                    {activeChannelId && threadRoot ? (
                      <ChatThreadPanel
                        teamId={teamId}
                        channelId={activeChannelId}
                        threadRoot={threadRoot}
                        members={mentionMembers}
                        currentUserId={user.id}
                        canWrite={canWrite}
                        isTeamAdmin={isTeamAdmin}
                        loadThread={loadThread}
                        markThreadRead={markThreadRead}
                        sendMessage={handleSend}
                        pingTyping={pingTyping}
                        sending={sending}
                        highlightMessageId={highlightMessageId}
                        threadSearchQuery={threadSearchQuery}
                        onEdit={handleEdit}
                        onDelete={(message) => void handleDeleteMessage(message)}
                        onAiCorrect={handleAiCorrect}
                        composerRef={threadComposerRef}
                      />
                    ) : activeChannelId ? (
                      <ChatMessageList
                        teamId={teamId}
                        messages={liveDisplayMessages}
                        currentUserId={user.id}
                        hydrated={isChannelHydrated}
                        canWrite={canWrite}
                        isTeamAdmin={isTeamAdmin}
                        highlightMessageId={highlightMessageId}
                        threadUnreadMap={threadUnreadMap}
                        userSentRef={userSentRef}
                        searchActive={messageSearchActive}
                        onHighlightDone={() => setHighlightMessageId(null)}
                        onEdit={handleEdit}
                        onDelete={(message) => void handleDeleteMessage(message)}
                        onAiCorrect={handleAiCorrect}
                        onReplyInThread={openThread}
                      />
                    ) : null}
                  </div>
                  {activeChannelId && !threadRoot ? (
                    <ChatComposer
                      ref={mainComposerRef}
                      teamId={teamId}
                      channelId={activeChannelId}
                      members={mentionMembers}
                      disabled={!canWrite || !activeChannelId}
                      sending={sending}
                      onSend={handleSend}
                      onTyping={pingTyping}
                      enterToSend={themePrefs.behavior.enterToSend}
                      showLinkPreviews={themePrefs.behavior.showLinkPreviews}
                    />
                  ) : null}
                </>
              ) : activeChannelId ? (
                <ChatSharedBrowser
                  teamId={teamId}
                  channelId={activeChannelId}
                  channels={channels}
                  members={members}
                  currentUserId={user.id}
                  isTeamAdmin={isTeamAdmin}
                  canWrite={canWrite}
                  refreshKey={sharedListEpoch}
                  onJumpToMessage={handleJumpToMessage}
                  onOpenThread={handleOpenThreadFromBrowser}
                  zoneClassName={mainZone.className}
                  zoneStyle={mainZone.style}
                  zoneTheme={mainZone["data-zone-theme"]}
                />
              ) : null}
            </div>
            {showHuddlePanel ? (
              <div className="flex w-80 shrink-0 min-h-0 flex-col">
                <ChatHuddleSidebar
                  channelLabel={huddleChannelLabel}
                  participantAvatars={huddleParticipantAvatars}
                  participantCount={huddleParticipantCount}
                  localStream={localStream}
                  remoteStream={remoteStream}
                  muted={callMuted}
                  cameraOff={callCameraOff}
                  micReady={micReady}
                  peerConnected={peerConnected}
                  presenting={presenting}
                  screenStream={screenStream}
                  callError={callError}
                  remotePeerLabel={huddleRemoteLabel}
                  currentUserId={user.id}
                  zoneClassName={rightZone.className}
                  zoneStyle={rightZone.style}
                  zoneTheme={rightZone["data-zone-theme"]}
                  onToggleMute={toggleMute}
                  onToggleCamera={toggleCamera}
                  onTogglePresent={togglePresent}
                  onLeave={() => void handleLeaveHuddle()}
                  onClose={() => setHuddleSidebarOpen(false)}
                  noiseCancellationStrength={noiseCancellationStrength}
                  onNoiseCancellationStrengthChange={handleNoiseCancellationStrengthChange}
                />
              </div>
            ) : null}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
