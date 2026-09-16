import "./globals.css";
import { Fraunces, Inter } from "next/font/google";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["600", "900"] });
const ui = Inter({ subsets: ["latin"], variable: "--font-ui" });

export const metadata = {
  title: "PhysiCoin — never trek to the wrong hall again",
  description: "Student-powered live timetable. Post a venue change, coursemates confirm it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
