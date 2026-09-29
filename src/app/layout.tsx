import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

// The same typefaces as Mo's portfolio.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "AI Analyst · Mo Pofahl",
  description:
    "Upload a CSV and ask questions in plain English. Claude writes the SQL, your browser runs it, and you get a chart, the exact query and an honest confidence level.",
  openGraph: {
    title: "AI Analyst",
    description: "Ask your data questions in plain English. Built by Mo Pofahl with Claude.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <div className="relative z-[1] flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
