import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.otconnect.physiocoach',
  appName: 'PhysioCoach AI',
  webDir: 'dist/physiocoach-ai-web/browser',
  server: {
    androidScheme: 'https',
    hostname: 'physiocoach.otconnect.ir',
  },
  plugins: {
    Browser: {
      presentationStyle: 'overFullScreen',
    },
  },
};

export default config;
