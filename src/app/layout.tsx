import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Me vs Me · الفارس الفارغ",
  description: "نظام تشغيل شخصي: يومك، أسبوعك، جسدك، دينك، تعافيك، كتبك — في مكان واحد.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-512.png", apple: "/icons/icon-512.png" },
  appleWebApp: { capable: true, title: "Me vs Me", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0b0b14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white">تخطي إلى المحتوى</a>
        {children}
      </body>
    </html>
  );
}
