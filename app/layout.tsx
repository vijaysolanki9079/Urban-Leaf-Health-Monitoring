import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FlaskConical, Leaf } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urban Leaf Monitoring",
  description: "Timeline-based vegetation health and land-cover change monitoring."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <Leaf size={22} aria-hidden />
            <span>Urban Leaf Monitoring</span>
          </Link>
          <nav className="nav">
            <Link href="/">
              <BarChart3 size={17} aria-hidden />
              Timeline
            </Link>
            <Link href="/hypothesis">
              <FlaskConical size={17} aria-hidden />
              Hypothesis
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
