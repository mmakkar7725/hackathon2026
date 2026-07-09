import type { Metadata } from "next";
import { IBM_Plex_Mono, Roboto } from "next/font/google";
import "./globals.css";

const bodyFont = Roboto({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "EligibilityAI",
  description: "AI-powered clinical trial patient screening. Transform clinical data into eligible trial subjects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://ds.cdn.questdiagnostics.com/DS-Icons.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
