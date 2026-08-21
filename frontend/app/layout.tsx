import type { Metadata } from "next";
import "./globals.css";
import "@xterm/xterm/css/xterm.css";

export const metadata: Metadata = {
  title: "Online Code Runner",
  description: "Interactive Cloud IDE sandbox with Docker execution",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#1e1e1e] text-white antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
