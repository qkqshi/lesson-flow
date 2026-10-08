import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Lesson Flow — расписание преподавателя",
  description: "Личное расписание уроков из Google Calendar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1eee5" },
    { media: "(prefers-color-scheme: dark)", color: "#171816" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js?63"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
