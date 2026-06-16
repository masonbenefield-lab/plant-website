'use client';

import { useEffect } from 'react';

export function PushNotificationProvider() {
  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        const status = await PushNotifications.requestPermissions();
        if (status.receive !== 'granted') return;

        await PushNotifications.register();

        // Send FCM/APNs token to our backend so we can push to this device
        PushNotifications.addListener('registration', async (token) => {
          const platform = Capacitor.getPlatform() as 'ios' | 'android';
          await fetch('/api/push-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform }),
          }).catch(() => {});
        });

        // When user taps a notification, navigate to the embedded deep link
        PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const url = event.notification.data?.url as string | undefined;
          if (url) window.location.href = url;
        });
      } catch {
        // Non-fatal: Capacitor not available or push permission denied
      }
    }

    init();
  }, []);

  return null;
}
