"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getMonthInputValue } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionForm } from "@/components/forms/transaction-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TransactionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState(getMonthInputValue());
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodType, setPeriodType] = useState<"daily" | "monthly" | "yearly" | "all">("monthly");
  const [categoryId, setCategoryId] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingError, setEditingError] = useState("");
  const editId = searchParams.get("edit");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({
      periodType,
      ...(periodType === "daily" ? { day } : {}),
      ...(periodType === "monthly" ? { month } : {}),
      ...(periodType === "yearly" ? { year } : {}),
      ...(categoryId !== "all" ? { categoryId } : {}),
      ...(type !== "all" ? { type } : {}),
      ...(query ? { query } : {}),
    });

    const [transactionsData, categoriesData] = await Promise.all([
      api.getTransactions(params),
      api.getCategories(),
    ]);
    setTransactions(transactionsData);
    setCategories(categoriesData);
  }, [periodType, day, month, year, categoryId, type, query]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  useEffect(() => {
    if (!editId) {
      setEditing(null);
      setEditingError("");
      return;
    }

    api.getTransaction(editId)
      .then((transaction) => {
        setEditing(transaction);
        setEditingError("");
      })
      .catch((error) => {
        setEditing(null);
        setEditingError(error instanceof Error ? error.message : "Kayit acilamadi.");
      });
  }, [editId]);

  const totals = useMemo(
    () => ({
      income: transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
      expense: transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    }),
    [transactions],
  );

  return (
    <div>
      <PageHeader
        title="Islemler"
        description="Kayitlari gun, ay, yil veya tum donem bazinda filtreleyin. Kategori, islem turu ve metin aramasi ile daraltin."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[220px_180px_220px_180px_1fr]">
          <Select value={periodType} onValueChange={(value) => setPeriodType(value as "daily" | "monthly" | "yearly" | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Donem filtresi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Gunluk</SelectItem>
              <SelectItem value="monthly">Aylik</SelectItem>
              <SelectItem value="yearly">Yillik</SelectItem>
              <SelectItem value="all">Tum donemler</SelectItem>
            </SelectContent>
          </Select>
          {periodType === "daily" ? (
            <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          ) : periodType === "monthly" ? (
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          ) : periodType === "yearly" ? (
            <Input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
          ) : (
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
              Tum donemler gosteriliyor
            </div>
          )}
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Kategori" />
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
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Tur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum islemler</SelectItem>
              <SelectItem value="income">Gelir</SelectItem>
              <SelectItem value="expense">Gider</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Aciklama veya kisi ara..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      {editing ? (
        <div className="mt-6">
          <PageHeader
            title="Kaydi Duzenle"
            description="Degisiklikleri kaydettikten sonra liste guncellenir."
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setEditingError("");
                  router.replace("/islemler");
                }}
              >
                Duzenlemeyi Kapat
              </Button>
            }
          />
          <TransactionForm
            initialData={editing}
            onSuccess={() => {
              setEditing(null);
              refresh().catch(console.error);
              router.replace("/islemler");
            }}
          />
        </div>
      ) : null}

      {editingError ? (
        <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {editingError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Filtreli gelir</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.income)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Filtreli gider</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.expense)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.income - totals.expense)}</CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Kayit listesi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length ? (
            transactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-4 rounded-2xl border border-border/70 bg-white p-4 xl:grid-cols-[140px_1.3fr_180px_140px_160px_120px] xl:items-center">
                <div className="text-sm text-muted-foreground">{formatDate(transaction.date)}</div>
                <div>
                  <p className="font-medium">{transaction.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{transaction.person}</p>
                </div>
                <div className="text-sm">{transaction.category.name}</div>
                <div className="text-sm">{transaction.type === "income" ? "Gelir" : "Gider"}</div>
                <div className="font-semibold">{formatCurrency(transaction.amount, transaction.currencyCode ?? "TRY")}</div>
                <div className="flex items-center gap-2 xl:justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setEditing(transaction);
                      setEditingError("");
                      router.replace(`/islemler?edit=${transaction.id}`);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Kayit silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu islem geri alinmaz. Kayit aylik raporlardan da kaldirilir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline">Vazgec</Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              await api.deleteTransaction(transaction.id);
                              refresh().catch(console.error);
                            }}
                          >
                            Sil
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/60 p-8 text-center text-sm text-muted-foreground">
              Bu filtrelerle eslesen kayit bulunmuyor.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
