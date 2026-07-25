"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Start", icon: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/history", label: "Historik", icon: "M12 8v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" },
  { href: "/stats", label: "Statistik", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/settings", label: "Mer", icon: "M4 6h16M4 12h16M4 18h16" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-md pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
