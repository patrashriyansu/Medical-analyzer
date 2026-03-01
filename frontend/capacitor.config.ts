import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.medicalanalyzer.app",
  appName: "MediTrack",
  webDir: "build",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
};

export default config;

