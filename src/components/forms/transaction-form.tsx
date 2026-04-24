"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/schemas";
import type { Category, Currency, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  initialData?: Transaction;
  onSuccess?: () => void;
};

export function TransactionForm({ initialData, onSuccess }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [message, setMessage] = useState<string>("");

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: initialData ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: initialData?.description ?? "",
      person: initialData?.person ?? "",
      amount: initialData?.amount ?? 0,
      currencyCode: initialData?.currencyCode ?? "TRY",
      type: initialData?.type ?? "expense",
      categoryId: initialData?.categoryId ?? "",
      notes: initialData?.notes ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      date: initialData ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: initialData?.description ?? "",
      person: initialData?.person ?? "",
      amount: initialData?.amount ?? 0,
      currencyCode: initialData?.currencyCode ?? "TRY",
      type: initialData?.type ?? "expense",
      categoryId: initialData?.categoryId ?? "",
      notes: initialData?.notes ?? "",
    });
  }, [form, initialData]);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getCurrencies()])
      .then(([categoriesData, currenciesData]) => {
        setCategories(categoriesData.filter((item) => item.isActive));
        setCurrencies(currenciesData);
      })
      .catch(console.error);
  }, []);

  async function onSubmit(values: TransactionFormValues) {
    try {
      if (initialData) {
        await api.updateTransaction(initialData.id, values);
        setMessage("Kayit guncellendi.");
      } else {
        await api.createTransaction(values);
        setMessage("Kayit basariyla eklendi.");
        form.reset({
          ...values,
          description: "",
          person: "",
          amount: 0,
          notes: "",
        });
      }

      onSuccess?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bir hata olustu.");
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Tarih</Label>
              <Input id="date" type="date" {...form.register("date")} />
              <p className="text-xs text-destructive">{form.formState.errors.date?.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Aciklama</Label>
              <Input id="description" placeholder="Orn. Ofis kahve alimi" {...form.register("description")} />
              <p className="text-xs text-destructive">{form.formState.errors.description?.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="person">Kim aldi / teslim aldi</Label>
              <Input id="person" placeholder="Orn. Ayse Yilmaz" {...form.register("person")} />
              <p className="text-xs text-destructive">{form.formState.errors.person?.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Tutar</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register("amount", { valueAsNumber: true })}
              />
              <p className="text-xs text-destructive">{form.formState.errors.amount?.message}</p>
            </div>

            <div className="space-y-2">
              <Label>Para birimi</Label>
              <Select
                value={form.watch("currencyCode")}
                onValueChange={(value) => form.setValue("currencyCode", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Para birimi secin" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Islem turu</Label>
              <Select value={form.watch("type")} onValueChange={(value) => form.setValue("type", value as "income" | "expense")}>
                <SelectTrigger>
                  <SelectValue placeholder="Tur secin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Gelir</SelectItem>
                  <SelectItem value="expense">Gider</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.watch("categoryId")} onValueChange={(value) => form.setValue("categoryId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori secin" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-destructive">{form.formState.errors.categoryId?.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Not</Label>
              <Textarea id="notes" placeholder="Istege bagli aciklama..." {...form.register("notes")} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/70 px-4 py-3">
            <p className="text-sm text-muted-foreground">{message || "Kayit sonrasi liste ve raporlar otomatik guncellenir."}</p>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {initialData ? "Kaydi Guncelle" : "Islemi Kaydet"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
