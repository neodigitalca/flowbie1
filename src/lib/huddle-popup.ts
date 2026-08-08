const HUDDLE_POPUP_STORAGE_KEY = "flowbie-huddle-popup";

export type HuddlePopupState = {
  callId: number;
  teamId: number;
  minimized: boolean;
};

export function huddlePopupUrl(teamId: number, callId: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const origin = window.location.origin;
  return `${origin}${base}/huddle?teamId=${teamId}&callId=${callId}`;
}

export function openHuddlePopup(teamId: number, callId: number): Window | null {
  const url = huddlePopupUrl(teamId, callId);
  const name = `flowbie-huddle-${callId}`;
  const popup = window.open(url, name, "width=440,height=620,resizable=yes");
  if (popup) {
    saveHuddlePopupState({ callId, teamId, minimized: false });
  }
  return popup;
}

export function saveHuddlePopupState(state: HuddlePopupState | null): void {
  if (!state) {
    localStorage.removeItem(HUDDLE_POPUP_STORAGE_KEY);
    return;
  }
  localStorage.setItem(HUDDLE_POPUP_STORAGE_KEY, JSON.stringify(state));
}

export function loadHuddlePopupState(): HuddlePopupState | null {
  try {
    const raw = localStorage.getItem(HUDDLE_POPUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HuddlePopupState;
    if (!parsed.callId || !parsed.teamId) return null;
    return parsed;
  } catch {
    return null;
  }
}
