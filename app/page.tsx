export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">PhysiCoin v3 · foundation</p>
      <h1 className="mt-4 text-4xl font-black">Never trek to the wrong hall again.</h1>
      <p className="mt-4 text-ink/70">
        Student-powered live timetable. Post a venue change, coursemates vote Yes or No,
        eight votes confirm it.
      </p>
    </main>
  );
}
