"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { formatCurrency, getMonthInputValue, getPreviousMonthInputValue } from "@/lib/format";
import type { Category, MonthlyReportData, ReportPeriodType } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PeriodSelection = {
  periodType: ReportPeriodType;
  day: string;
  month: string;
  year: string;
  categoryId: string;
};

function ReportPeriodControls({
  value,
  onChange,
  categories,
}: {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  categories: Category[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={value.periodType}
        onValueChange={(periodType) =>
          onChange({ ...value, periodType: periodType as ReportPeriodType })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Donem secin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">Gunluk</SelectItem>
          <SelectItem value="monthly">Aylik</SelectItem>
          <SelectItem value="yearly">Yillik</SelectItem>
          <SelectItem value="all">Tum donemler</SelectItem>
        </SelectContent>
      </Select>
      {value.periodType === "daily" ? (
        <Input
          className="w-[180px]"
          type="date"
          value={value.day}
          onChange={(event) => onChange({ ...value, day: event.target.value })}
        />
      ) : value.periodType === "monthly" ? (
        <Input
          className="w-[170px]"
          type="month"
          value={value.month}
          onChange={(event) => onChange({ ...value, month: event.target.value })}
        />
      ) : value.periodType === "yearly" ? (
        <Input
          className="w-[140px]"
          type="number"
          min="2000"
          max="2100"
          value={value.year}
          onChange={(event) => onChange({ ...value, year: event.target.value })}
        />
      ) : (
        <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
          Tum donemler
        </div>
      )}
      <Select
        value={value.categoryId}
        onValueChange={(categoryId) => onChange({ ...value, categoryId })}
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder="Kategori secin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tum kategoriler</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReportsView() {
  const initial = getMonthInputValue();
  const previousMonth = getPreviousMonthInputValue();
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = String(new Date().getFullYear());
  const [categories, setCategories] = useState<Category[]>([]);
  const [selection, setSelection] = useState<PeriodSelection>({
    periodType: "monthly",
    month: initial,
    day: today,
    year: currentYear,
    categoryId: "all",
  });
  const [compareLeft, setCompareLeft] = useState<PeriodSelection>({
    periodType: "monthly",
    month: initial,
    day: today,
    year: currentYear,
    categoryId: "all",
  });
  const [compareRight, setCompareRight] = useState<PeriodSelection>({
    periodType: "monthly",
    month: previousMonth,
    day: today,
    year: currentYear,
    categoryId: "all",
  });
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [leftReport, setLeftReport] = useState<MonthlyReportData | null>(null);
  const [rightReport, setRightReport] = useState<MonthlyReportData | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      periodType: selection.periodType,
      ...(selection.periodType === "daily" ? { day: selection.day } : {}),
      ...(selection.periodType === "monthly" ? { month: selection.month } : {}),
      ...(selection.periodType === "yearly" ? { year: selection.year } : {}),
      ...(selection.categoryId !== "all" ? { categoryId: selection.categoryId } : {}),
    });

    api.getPeriodReport(params).then(setReport).catch(console.error);
  }, [selection]);

  useEffect(() => {
    const leftParams = new URLSearchParams({
      periodType: compareLeft.periodType,
      ...(compareLeft.periodType === "daily" ? { day: compareLeft.day } : {}),
      ...(compareLeft.periodType === "monthly" ? { month: compareLeft.month } : {}),
      ...(compareLeft.periodType === "yearly" ? { year: compareLeft.year } : {}),
      ...(compareLeft.categoryId !== "all" ? { categoryId: compareLeft.categoryId } : {}),
    });
    const rightParams = new URLSearchParams({
      periodType: compareRight.periodType,
      ...(compareRight.periodType === "daily" ? { day: compareRight.day } : {}),
      ...(compareRight.periodType === "monthly" ? { month: compareRight.month } : {}),
      ...(compareRight.periodType === "yearly" ? { year: compareRight.year } : {}),
      ...(compareRight.categoryId !== "all" ? { categoryId: compareRight.categoryId } : {}),
    });

    Promise.all([api.getPeriodReport(leftParams), api.getPeriodReport(rightParams)])
      .then(([left, right]) => {
        setLeftReport(left);
        setRightReport(right);
      })
      .catch(console.error);
  }, [compareLeft, compareRight]);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const selectedCategoryName =
    selection.categoryId === "all"
      ? "Tum kategoriler"
      : categories.find((category) => category.id === selection.categoryId)?.name ?? "Secili kategori";

  const leftCategoryName =
    compareLeft.categoryId === "all"
      ? "Tum kategoriler"
      : categories.find((category) => category.id === compareLeft.categoryId)?.name ?? "Secili kategori";

  const rightCategoryName =
    compareRight.categoryId === "all"
      ? "Tum kategoriler"
      : categories.find((category) => category.id === compareRight.categoryId)?.name ?? "Secili kategori";

  const comparisonMode =
    compareLeft.categoryId !== compareRight.categoryId &&
    compareLeft.periodType === compareRight.periodType &&
    compareLeft.day === compareRight.day &&
    compareLeft.month === compareRight.month &&
    compareLeft.year === compareRight.year
      ? "Kategori bazli karsilastirma"
      : compareLeft.categoryId !== compareRight.categoryId
        ? "Donem ve kategori birlikte karsilastiriliyor"
        : "Donem bazli karsilastirma";

  return (
    <div>
      <PageHeader
        title="Raporlar"
        description="Gunluk, aylik, yillik veya tum donem bazinda gelir, gider, net sonuc ve kategori dagilimini inceleyin."
        actions={<ReportPeriodControls value={selection} onChange={setSelection} categories={categories} />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Toplam gelir</CardDescription>
            <CardTitle>{formatCurrency(report?.totals.income ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Toplam gider</CardDescription>
            <CardTitle>{formatCurrency(report?.totals.expense ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Net sonuc</CardDescription>
            <CardTitle>{formatCurrency(report?.totals.net ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Donem hareketi</CardTitle>
            <CardDescription>PDF veya Excel disa aktarma icin uygun yapiya hazir ozet</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            {chartReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report?.dailyTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Legend />
                  <Bar dataKey="income" fill="#2a9d8f" name="Gelir" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#e76f51" name="Gider" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori bazli toplamlar</CardTitle>
            <CardDescription>
              {report?.periodLabel ?? "Secili donem"} • {selectedCategoryName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report?.byCategory.length ? (
              report.byCategory.map((item) => (
                <div key={item.category} className="rounded-2xl border border-border/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{item.category}</p>
                    <p className="text-sm text-muted-foreground">Net: {formatCurrency(item.net)}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-xl bg-muted/70 px-3 py-2">Gelir: {formatCurrency(item.income)}</div>
                    <div className="rounded-xl bg-muted/70 px-3 py-2">Gider: {formatCurrency(item.expense)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/60 p-8 text-sm text-muted-foreground">
                Secilen donem icin rapor verisi yok.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Donem Karsilastirmasi</CardTitle>
            <CardDescription>
              Varsayilan olarak bu ay ve gecen ay gelir. Donem, kategori veya ikisini birlikte karsilastirin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-white p-4">
              <p className="mb-3 text-sm font-medium">Donem 1</p>
              <ReportPeriodControls value={compareLeft} onChange={setCompareLeft} categories={categories} />
              <p className="mt-3 text-sm text-muted-foreground">
                {leftReport?.periodLabel ?? "Donem secin"} • {leftCategoryName}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-white p-4">
              <p className="mb-3 text-sm font-medium">Donem 2</p>
              <ReportPeriodControls value={compareRight} onChange={setCompareRight} categories={categories} />
              <p className="mt-3 text-sm text-muted-foreground">
                {rightReport?.periodLabel ?? "Donem secin"} • {rightCategoryName}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {comparisonMode}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/70 p-4">
                <p className="text-sm text-muted-foreground">Gelir farki</p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency((leftReport?.totals.income ?? 0) - (rightReport?.totals.income ?? 0))}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4">
                <p className="text-sm text-muted-foreground">Gider farki</p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency((leftReport?.totals.expense ?? 0) - (rightReport?.totals.expense ?? 0))}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4">
                <p className="text-sm text-muted-foreground">Net farki</p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency((leftReport?.totals.net ?? 0) - (rightReport?.totals.net ?? 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Karsilastirma Ozeti</CardTitle>
            <CardDescription>
              {leftReport?.periodLabel ?? "Donem 1"} / {leftCategoryName} ve {rightReport?.periodLabel ?? "Donem 2"} / {rightCategoryName} yan yana
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-white p-4">
                <p className="text-sm text-muted-foreground">Donem 1</p>
                <p className="mt-2 font-semibold">{leftReport?.periodLabel ?? "-"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{leftCategoryName}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div>Gelir: {formatCurrency(leftReport?.totals.income ?? 0)}</div>
                  <div>Gider: {formatCurrency(leftReport?.totals.expense ?? 0)}</div>
                  <div>Net: {formatCurrency(leftReport?.totals.net ?? 0)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white p-4">
                <p className="text-sm text-muted-foreground">Donem 2</p>
                <p className="mt-2 font-semibold">{rightReport?.periodLabel ?? "-"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{rightCategoryName}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div>Gelir: {formatCurrency(rightReport?.totals.income ?? 0)}</div>
                  <div>Gider: {formatCurrency(rightReport?.totals.expense ?? 0)}</div>
                  <div>Net: {formatCurrency(rightReport?.totals.net ?? 0)}</div>
                </div>
              </div>
            </div>
            {chartReady ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        metric: "Gelir",
                        left: leftReport?.totals.income ?? 0,
                        right: rightReport?.totals.income ?? 0,
                      },
                      {
                        metric: "Gider",
                        left: leftReport?.totals.expense ?? 0,
                        right: rightReport?.totals.expense ?? 0,
                      },
                      {
                        metric: "Net",
                        left: leftReport?.totals.net ?? 0,
                        right: rightReport?.totals.net ?? 0,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Legend />
                    <Bar dataKey="left" name={`${leftReport?.periodLabel ?? "Donem 1"} • ${leftCategoryName}`} fill="#264653">
                      {[0, 1, 2].map((index) => (
                        <Cell key={`left-${index}`} fill="#264653" />
                      ))}
                    </Bar>
                    <Bar dataKey="right" name={`${rightReport?.periodLabel ?? "Donem 2"} • ${rightCategoryName}`} fill="#f4a261">
                      {[0, 1, 2].map((index) => (
                        <Cell key={`right-${index}`} fill="#f4a261" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
