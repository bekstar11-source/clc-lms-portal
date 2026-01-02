import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clc.portal',
  appName: 'CLC Portal',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'https' // <--- MANA SHUNI QO'SHING
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;