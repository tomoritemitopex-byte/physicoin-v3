import "./globals.css";

export const metadata = {
  title: "PhysiCoin v3",
  description: "Student-powered live timetable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
