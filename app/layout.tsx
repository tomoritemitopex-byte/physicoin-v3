import "./globals.css";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";

const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});
const ui = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "PhysiCoin — the campus timetable that fights back",
  description:
    "Student-powered live timetable. Post a venue change, coursemates confirm it, and every win locks a block. Advisory, not official.",
  metadataBase: new URL("https://physicoin-v3.vercel.app"),
  openGraph: {
    title: "PhysiCoin — know the move before you move",
    description: "Live campus signal, verified by students. Mine the timetable, own the chain.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c6f135",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
