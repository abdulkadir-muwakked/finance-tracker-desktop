"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, LayoutDashboard, PlusCircle, Settings2, Tags } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/yeni-islem", label: "Yeni Islem", icon: PlusCircle },
  { href: "/islemler", label: "Islemler", icon: CreditCard },
  { href: "/raporlar", label: "Aylik Raporlar", icon: BarChart3 },
  { href: "/kategoriler", label: "Kategoriler", icon: Tags },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [workspaceName, setWorkspaceName] = useState("Ofis Butce Masasi");

  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        if (settings.workspaceName?.trim()) {
          setWorkspaceName(settings.workspaceName);
        }
      })
      .catch(() => {
        // Keep the static fallback when settings cannot be loaded.
      });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail?.trim()) {
        setWorkspaceName(customEvent.detail);
      }
    };

    window.addEventListener("workspace-name-updated", handler as EventListener);
    return () => {
      window.removeEventListener("workspace-name-updated", handler as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-[280px_1fr] gap-6 px-6 py-6">
        <aside className="rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,#264653_0%,#20323f_100%)] p-6 text-white shadow-soft">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Finans Takip</p>
            <h1 className="mt-3 text-2xl font-semibold">{workspaceName}</h1>
            <p className="mt-2 text-sm text-white/75">
              Gelir, gider ve aylik durum takibini tek masaustu uygulamada yonetin.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                    active ? "bg-white text-primary" : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-2xl bg-white/10 p-4 text-sm text-white/80">
            <p className="font-medium text-white">Yerel veri guvencesi</p>
            <p className="mt-2 leading-6">
              Veriler SQLite ile bu bilgisayarda saklanir. Internet veya harici servis gerekmez.
            </p>
          </div>
        </aside>

        <main className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,#ffffff_0%,#f8faf7_45%,#eef1ea_100%)] shadow-soft">
          <div className="h-full p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
