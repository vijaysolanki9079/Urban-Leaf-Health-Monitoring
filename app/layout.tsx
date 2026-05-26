import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import SiteHeader from "@/components/site-header";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Urban Leaf Monitoring",
  description: "Timeline-based vegetation health and land-cover change monitoring."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={manrope.variable}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
