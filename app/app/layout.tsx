export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink/10 bg-white/80 px-4 py-3 backdrop-blur">
        <a href="/" className="font-display text-xl font-black tracking-tight">
          PhysiCoin
        </a>
        <nav className="flex gap-4 text-sm font-semibold">
          <a href="/app/roadmap">Road</a>
          <a href="/app/mining">Mining</a>
          <a href="/app/profile">Profile</a>
        </nav>
      </header>
      <main>{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 flex justify-center gap-8 border-t border-sky/30 bg-white/95 py-3 text-sm font-bold">
        <a href="/app/roadmap">🛣 Road</a>
        <a href="/app/mining">⛏ Mine</a>
        <a href="/app/profile">👤 Profile</a>
      </nav>
    </div>
  );
}
