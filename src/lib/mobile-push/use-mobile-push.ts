import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { payloadFromNotificationData, resolveMobilePushDeepLink } from "@/lib/mobile-push/deep-link";
import { registerPushDevice } from "@/lib/mobile-push/push-api";
import type { MobilePushDeepLink } from "@/lib/mobile-push/types";

type UseMobilePushOptions = {
  enabled: boolean;
  onDeepLink: (link: MobilePushDeepLink) => void;
  onReady?: (ready: boolean) => void;
};

function parsePushData(data: unknown): MobilePushDeepLink | null {
  if (!data || typeof data !== "object") return null;
  const payload = payloadFromNotificationData(data as Record<string, unknown>);
  if (!payload) return null;
  return resolveMobilePushDeepLink(payload);
}

export function useMobilePush({ enabled, onDeepLink, onReady }: UseMobilePushOptions): void {
  const onDeepLinkRef = useRef(onDeepLink);
  const onReadyRef = useRef(onReady);
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    onDeepLinkRef.current = onDeepLink;
  }, [onDeepLink]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) {
      onReadyRef.current?.(false);
      return;
    }

    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const registrationListener = await PushNotifications.addListener(
          "registration",
          (token) => {
            const value = token.value?.trim();
            if (!value || registeredTokenRef.current === value) return;
            registeredTokenRef.current = value;
            void registerPushDevice({
              token: value,
              platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
              deviceLabel: Capacitor.getPlatform(),
              appVersion: "1.0.0",
            });
          },
        );
        listeners.push(registrationListener);

        const registrationErrorListener = await PushNotifications.addListener(
          "registrationError",
          () => {
            onReadyRef.current?.(false);
          },
        );
        listeners.push(registrationErrorListener);

        const actionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (event) => {
            const link = parsePushData(event.notification.data);
            if (link) onDeepLinkRef.current(link);
          },
        );
        listeners.push(actionListener);

        const receivedListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            const link = parsePushData(notification.data);
            if (link) onDeepLinkRef.current(link);
          },
        );
        listeners.push(receivedListener);

        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          onReadyRef.current?.(false);
          return;
        }

        await PushNotifications.register();
        if (!cancelled) onReadyRef.current?.(true);
      } catch {
        onReadyRef.current?.(false);
      }
    })();

    return () => {
      cancelled = true;
      void Promise.all(listeners.map((listener) => listener.remove()));
    };
  }, [enabled]);
}
