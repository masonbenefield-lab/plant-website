import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'shop.plantet.app',
  appName: 'Plantet',
  webDir: 'cap-web',
  server: {
    // Load the live Vercel deployment — keeps all server-side logic intact.
    // Remove this block for offline/local builds.
    url: 'https://www.plantet.shop',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
