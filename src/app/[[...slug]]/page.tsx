"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// التطبيق كله client-side (IndexedDB local-first). الـroutes تُحل داخل AppShell مع legacy redirects.
const AppShell = dynamic(() => import("../AppShell"), { ssr: false, loading: () => <div className="grid min-h-screen place-items-center text-sm text-muted">جارٍ التحميل…</div> });

export default function CatchAllPage() {
  return <Suspense fallback={null}><AppShell /></Suspense>;
}
