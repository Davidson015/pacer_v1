"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/track", label: "Track" },
  { href: "/coach", label: "Coach" },
  { href: "/live", label: "Live" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/build-map", label: "Build map" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10 bg-black text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4">
        <Link
          href="/"
          className={`shrink-0 rounded-full px-3 py-2 text-lg font-black tracking-tight ${
            pathname === "/" ? "bg-[#c6ff00] text-black" : "text-white"
          }`}
        >
          Pacer<span className="text-[#c6ff00]">.</span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-end sm:gap-2"
        >
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[#c6ff00] text-black"
                    : "text-white/65 hover:bg-white/10 hover:text-[#c6ff00]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
