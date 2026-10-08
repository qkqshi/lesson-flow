export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        colorScheme: "light" | "dark";
        ready: () => void;
        expand: () => void;
        openLink: (url: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
        };
      };
    };
  }
}
