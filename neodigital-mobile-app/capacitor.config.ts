import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.neodigital.neopulse.mobile',
  appName: 'NEOPulse',
  webDir: 'www',
  server: {
    url: 'https://neodigital.ca/mobile/',
    cleartext: false,
  },
  android: {
    backgroundColor: '#000000',
    appendUserAgent: ' NEOPulseMobile/1',
  },
  ios: {
    appendUserAgent: ' NEOPulseMobile/1',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
