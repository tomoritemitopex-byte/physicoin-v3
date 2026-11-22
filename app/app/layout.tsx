import Link from "next/link";
import AppNav from "@/components/ui/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppNav />
      <main className="pb-24 lg:pb-0">{children}</main>
      <footer className="mx-auto max-w-[1280px] border-t-[3px] border-ink px-4 py-6 text-center font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55 sm:px-6 lg:px-8">
        PHYSICOIN · built by students ·{" "}
        <Link href="/terms" className="underline">
          terms
        </Link>
      </footer>
    </div>
  );
}
