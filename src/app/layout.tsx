import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Finans Takip",
  description: "Gelir ve gider takibi icin masaustu uygulamasi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

