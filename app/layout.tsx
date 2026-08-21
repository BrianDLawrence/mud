import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextMUD — Development Realm",
  description: "A text-first, automation-ready multiplayer role-playing world.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
