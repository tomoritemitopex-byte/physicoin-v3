"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  road: (
    <path d="M4 19c3-3 2-7 4-9s5 0 6-3M4 19h16" />
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h3M8 17h6" />
    </>
  ),
  mine: (
    <>
      <path d="M3 20l7-7M14 4l6 6M13 5l6 6M4 4l16 16" />
      <path d="M14 4a4 4 0 016 6" />
    </>
  ),
  chain: (
    <>
      <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M7 9h10M7 13h7M7 17h4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  game: (
    <>
      <path d="M6 8h12l2 9a2 2 0 01-3.6 1.6L15 17H9l-1.4 1.6A2 2 0 014 17z" />
      <path d="M9 12h2M10 11v2M15 12h.01M17 14h.01" />
    </>
  ),
} as const;

const HEADER_TABS: Tab[] = [
  { href: "/app", label: "Live", icon: "board" },
  { href: "/app/roadmap", label: "Road", icon: "road" },
  { href: "/app/schedule", label: "Table", icon: "table" },
  { href: "/app/mining", label: "Mine", icon: "mine" },
  { href: "/app/rounds", label: "Chain", icon: "chain" },
  { href: "/app/board", label: "Board", icon: "board" },
  { href: "/app/profile", label: "Profile", icon: "profile" },
];

const BOTTOM_TABS: Tab[] = [
  { href: "/app", label: "Live", icon: "board" },
  { href: "/app/schedule", label: "Table", icon: "table" },
  { href: "/app/mining", label: "Mine", icon: "mine" },
  { href: "/app/rounds", label: "Chain", icon: "chain" },
  { href: "/app/profile", label: "Profile", icon: "profile" },
];

function Icon({ name, className = "" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

export default function AppNav() {
  const pathname = usePathname() || "";
  const [handle, setHandle] = useState("");
  const [balance, setBalance] = useState("");

  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem("physi_profile");
        const p = raw ? JSON.parse(raw) : null;
        setHandle(p?.nickname || "");
        setBalance(p?.mining_balance != null ? String(p.mining_balance) : "");
      } catch {}
    }
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="PhysiCoin home">
            <span className="grid h-9 w-9 place-items-center border-[3px] border-ink bg-lime font-display text-base shadow-brutal-sm">
              P
            </span>
            <span className="font-display text-base tracking-tight">PHYSICOIN</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {HEADER_TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                  active(t.href)
                    ? "border-ink bg-lime shadow-brutal-sm"
                    : "border-transparent hover:border-ink hover:bg-white"
                }`}
              >
                <Icon name={t.icon} className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/app/profile"
            className="inline-flex items-center gap-2 border-[3px] border-ink bg-white px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] shadow-brutal-sm"
          >
            <span className="h-2 w-2 bg-green" />
            <span className="hidden sm:inline">{handle ? `@${handle}` : "Wallet"}</span>
            <span className="text-ink/55">{balance ? `${Number(balance).toFixed(1)} $PHY` : "connect"}</span>
          </Link>
        </div>

        <div className="border-t-2 border-ink/15 bg-lime/70">
          <p className="mx-auto max-w-[1280px] px-4 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70 sm:px-6">
            advisory feed · campus live · not official university communication
          </p>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper lg:hidden">
        <div className="mx-auto flex max-w-[560px] items-stretch justify-between px-1.5 py-1.5">
          {BOTTOM_TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 border-2 px-1 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em] ${
                active(t.href) ? "border-ink bg-lime" : "border-transparent text-ink/60"
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5" />
              {t.label}
            </Link>
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
