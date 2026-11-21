import Link from "next/link";

const links = [
  ["Home", "/app/game"], ["Schedule", "/app/schedule"], ["Community", "/app/board"], ["Mining", "/app/mining"], ["Network", "/app/ecosystem"], ["Profile", "/app/profile"],
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07110f] text-[#edf8f1]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07110f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-[.16em]">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200/35 bg-emerald-200/10 font-display text-emerald-200">P</span>
            PHYSICOIN
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {links.map(([label, href]) => <Link key={href} href={href} className="rounded-full px-3 py-2 text-sm font-bold text-white/55 transition hover:bg-white/5 hover:text-white">{label}</Link>)}
          </nav>
          <Link href="/app/profile" className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">Wallet</Link>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] pb-24 md:pb-8">{children}</main>
      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-white/10 bg-[#0e1c19]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {links.slice(0, 5).map(([label, href]) => <Link key={href} href={href} className="rounded-xl px-1 py-2 text-center text-[11px] font-bold text-white/55 hover:bg-white/5 hover:text-emerald-200">{label}</Link>)}
      </nav>
    </div>
  );
}
