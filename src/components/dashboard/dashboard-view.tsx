"use client";

import { useEffect, useState } from "react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getMonthInputValue } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const colors = ["#264653", "#2a9d8f", "#f4a261", "#e76f51", "#8ab17d"];

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [month, setMonth] = useState(getMonthInputValue());
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    api.getDashboard(month).then(setData).catch(console.error);
  }, [month]);

  useEffect(() => {
    setChartReady(true);
  }, []);

  return (
    <div>
      <PageHeader
        title="Genel Panel"
        description="Cari ay ozetini, son islemleri ve kategori bazli gider dagilimini hizlica gorun."
        actions={<input className="h-10 rounded-md border border-input bg-white px-3 text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(38,70,83,0.96),rgba(42,157,143,0.88))] text-white">
          <CardHeader>
            <CardDescription className="text-white/75">Kasada mevcut genel bakiye</CardDescription>
            <CardTitle className="text-3xl text-white">{formatCurrency(data?.overallTotals.net ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-white/70">Toplam giren</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(data?.overallTotals.income ?? 0)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-white/70">Toplam cikan</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(data?.overallTotals.expense ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bu ay toplam gelir</CardDescription>
            <CardTitle>{formatCurrency(data?.totals.income ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bu ay toplam gider</CardDescription>
            <CardTitle>{formatCurrency(data?.totals.expense ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{data?.monthLabel ?? "Secili ay"} net sonuc</CardDescription>
            <CardTitle>{formatCurrency(data?.totals.net ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Kategoriye gore gider dagilimi</CardTitle>
            <CardDescription>{data?.monthLabel ?? "Secili ay"} icin kategori bazli gorunum</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="h-[320px]">
              {chartReady && data?.categoryDistribution.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.categoryDistribution} dataKey="total" nameKey="category" innerRadius={80} outerRadius={120}>
                      {data.categoryDistribution.map((entry, index) => (
                        <Cell key={entry.category} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/60 text-sm text-muted-foreground">
                  Secili ay icin gider verisi bulunmuyor.
                </div>
              )}
            </div>
            <div className="space-y-3">
              {data?.categoryDistribution.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                    <span className="text-sm font-medium">{item.category}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son islemler</CardTitle>
            <CardDescription>Hizli kontrol icin son kayitlar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recentTransactions.length ? (
              data.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-border/70 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {transaction.person} • {transaction.category.name} • {formatDate(transaction.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={transaction.type === "income" ? "success" : "warning"}>
                        {transaction.type === "income" ? "Gelir" : "Gider"}
                      </Badge>
                      <p className="mt-2 font-semibold">{formatCurrency(transaction.amount, transaction.currencyCode ?? "TRY")}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/60 p-6 text-sm text-muted-foreground">
                Henuz islem kaydi yok. Yeni Islem sayfasindan ilk kaydi ekleyebilirsiniz.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
