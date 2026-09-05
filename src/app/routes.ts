import type { ComponentType } from "react";
import dynamic from "next/dynamic";

export type RouteId = "day" | "week" | "month" | "challenges" | "quran" | "training" | "menu" | "library" | "ai" | "goals" | "me" | "healing" | "brain-dump" | "settings";
export interface RouteDef { id: RouteId; path: string; label: string; icon: string; group: "primary" | "secondary" | "more"; component: ComponentType }

const lazy = (loader: () => Promise<{ default: ComponentType }>) => dynamic(loader, { ssr: false, loading: () => null });

export const ROUTES: RouteDef[] = [
  { id: "day", path: "/day", label: "يومي", icon: "☀️", group: "primary", component: lazy(() => import("@/features/day/DayPage")) },
  { id: "week", path: "/week", label: "أسبوعي", icon: "📅", group: "primary", component: lazy(() => import("@/features/week/WeekPage")) },
  { id: "month", path: "/month", label: "شهري", icon: "🗓️", group: "primary", component: lazy(() => import("@/features/month/MonthPage")) },
  { id: "challenges", path: "/challenges", label: "التحديات", icon: "⚔️", group: "secondary", component: lazy(() => import("@/features/challenges/ChallengesPage")) },
  { id: "quran", path: "/quran", label: "القرآن", icon: "📖", group: "secondary", component: lazy(() => import("@/features/quran/QuranPage")) },
  { id: "training", path: "/training", label: "التدريب", icon: "🧭", group: "secondary", component: lazy(() => import("@/features/training/TrainingPage")) },
  { id: "menu", path: "/menu", label: "القائمة", icon: "🧩", group: "more", component: lazy(() => import("@/features/menu/MenuPage")) },
  { id: "library", path: "/library", label: "المكتبة", icon: "📚", group: "more", component: lazy(() => import("@/features/library/LibraryPage")) },
  { id: "ai", path: "/ai", label: "الذكاء", icon: "🤖", group: "more", component: lazy(() => import("@/features/ai/AiPage")) },
  { id: "goals", path: "/goals", label: "الأهداف", icon: "🎯", group: "more", component: lazy(() => import("@/features/goals/GoalsPage")) },
  { id: "me", path: "/me", label: "أنا", icon: "🛡️", group: "more", component: lazy(() => import("@/features/me/MePage")) },
  { id: "healing", path: "/healing", label: "التعافي", icon: "🌱", group: "more", component: lazy(() => import("@/features/healing/HealingPage")) },
  { id: "brain-dump", path: "/brain-dump", label: "تفريغ العقل", icon: "🧠", group: "more", component: lazy(() => import("@/features/brain-dump/BrainDumpPage")) },
  { id: "settings", path: "/settings", label: "الإعدادات", icon: "⚙️", group: "more", component: lazy(() => import("@/features/settings/SettingsPage")) },
];

/** legacy routes → new (لا نكسر الروابط القديمة) */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/": "/day", "/today": "/day", "/myday": "/day", "/my-day": "/day", "/daily": "/day",
  "/myweek": "/week", "/my-week": "/week", "/weekly": "/week",
  "/mymonth": "/month", "/my-month": "/month", "/monthly": "/month",
  "/recovery": "/healing", "/heal": "/healing", "/sobriety": "/healing",
  "/books": "/library?tab=books", "/reader": "/library?tab=reader", "/courses": "/library?tab=courses", "/drive": "/library?tab=drive",
  "/profile": "/me", "/player": "/me", "/identity": "/me?tab=identity",
  "/assistant": "/ai", "/chat": "/ai",
  "/dump": "/brain-dump", "/braindump": "/brain-dump",
  "/body": "/goals?tab=body", "/finance": "/goals?tab=finance", "/photos": "/goals?tab=body&view=photos",
  "/main": "/menu", "/home": "/menu", "/more": "/menu",
  "/backup": "/settings?section=data", "/config": "/settings",
};
export function resolveRoute(pathname: string): { route: RouteDef; redirectTo?: string } {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const direct = ROUTES.find((r) => r.path === clean);
  if (direct) return { route: direct };
  const redirect = LEGACY_REDIRECTS[clean];
  if (redirect) { const base = redirect.split("?")[0]; return { route: ROUTES.find((r) => r.path === base) ?? ROUTES[0], redirectTo: redirect }; }
  return { route: ROUTES[0], redirectTo: "/day" };
}
