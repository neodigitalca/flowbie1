export type ChatTestNotificationResult = {
  ok: boolean;
  message: string;
};

function notificationIconUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const base = window.location.pathname.startsWith("/flowbie") ? "/flowbie" : "";
  return `${window.location.origin}${base}/placeholder.svg`;
}

export function chatNotificationPermissionLabel(): string {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function showChatDesktopNotification(
  title: string,
  body: string,
  opts?: { tag?: string; requireInteraction?: boolean; waitForShow?: boolean },
): Promise<ChatTestNotificationResult> {
  if (typeof Notification === "undefined") {
    return Promise.resolve({ ok: false, message: "This browser does not support desktop notifications." });
  }
  if (Notification.permission !== "granted") {
    return Promise.resolve({
      ok: false,
      message: `Permission is ${Notification.permission}. Allow notifications for this site first.`,
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ChatTestNotificationResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const notification = new Notification(title, {
        body,
        tag: opts?.tag ?? `flowbie-chat-${Date.now()}`,
        requireInteraction: opts?.requireInteraction ?? false,
        icon: notificationIconUrl(),
      });

      if (!opts?.waitForShow) {
        finish({ ok: true, message: "Notification queued." });
        return;
      }

      notification.onshow = () => {
        finish({
          ok: true,
          message:
            "Notification displayed. Check the bottom-right corner of your screen or Action Center (Win+N).",
        });
      };
      notification.onerror = () => {
        finish({
          ok: false,
          message: "Browser failed to display the notification. Check site notification settings.",
        });
      };
      window.setTimeout(() => {
        finish({
          ok: true,
          message:
            "Permission granted, but Windows did not confirm the toast. Open Action Center (Win+N) or enable Chrome in Windows Settings → System → Notifications.",
        });
      }, 4000);
    } catch (err) {
      finish({
        ok: false,
        message: err instanceof Error ? err.message : "Could not create notification.",
      });
    }
  });
}

export async function queueChatTestNotification(): Promise<ChatTestNotificationResult> {
  if (typeof Notification === "undefined") {
    return { ok: false, message: "This browser does not support desktop notifications." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      ok: false,
      message: "Notification permission is blocked. Allow flowbie.ca in your browser site settings.",
    };
  }

  return showChatDesktopNotification("Flowbie Chat", "Test notification. Desktop alerts are working.", {
    tag: `flowbie-chat-test-${Date.now()}`,
    requireInteraction: true,
    waitForShow: true,
  });
}

export function playChatTestSound(
  preset: "subtle" | "classic" | "none",
): ChatTestNotificationResult {
  if (preset === "none") {
    return { ok: false, message: "Sound preset is set to None." };
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = preset === "classic" ? 880 : 660;
    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
    return { ok: true, message: "Test sound played." };
  } catch {
    return { ok: false, message: "Could not play test sound in this browser." };
  }
}
