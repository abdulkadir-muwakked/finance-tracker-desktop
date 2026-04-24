"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { categorySchema, type CategoryFormValues } from "@/lib/schemas";
import type { Category, DeleteCategoryBlockedPayload } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [deleteBlockInfo, setDeleteBlockInfo] = useState<DeleteCategoryBlockedPayload | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function refresh() {
    const result = await api.getCategories();
    setCategories(result);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  return (
    <div>
      <PageHeader
        title="Kategori Yonetimi"
        description="Varsayilan kategorileri aktif tutun, yeni kategoriler ekleyin ve kullanim durumlarini yonetin."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Yeni kategori ekle</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await api.createCategory(values);
                  setMessage("Kategori eklendi.");
                  setDeleteBlockInfo(null);
                  form.reset();
                  refresh().catch(console.error);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Bir hata olustu.");
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Kategori adi</Label>
                <Input id="name" {...form.register("name")} />
                <p className="text-xs text-destructive">{form.formState.errors.name?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Aciklama</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
              <Button type="submit" className="w-full">
                Kategori Ekle
              </Button>
              <p className="text-sm text-muted-foreground">
                {message || "Islem listesi ve formlar yeni kategoriyi aninda kullanir."}
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mevcut kategoriler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deleteBlockInfo ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="font-medium text-destructive">{deleteBlockInfo.message}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Bu kategoriye bagli toplam {deleteBlockInfo.transactionCount} islem var. Asagida ilk{" "}
                  {deleteBlockInfo.linkedTransactions.length} kayit listeleniyor.
                </p>
                <div className="mt-4 space-y-3">
                  {deleteBlockInfo.linkedTransactions.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/70 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(item.date)} • {item.person}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {item.type === "income" ? "Gelir" : "Gider"}
                          </p>
                          <p className="font-semibold">{formatCurrency(item.amount)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/islemler?edit=${item.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Duzenle
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-white p-4"
              >
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.description || "Aciklama girilmedi."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await api.updateCategory(category.id, { isActive: !category.isActive });
                      setDeleteBlockInfo(null);
                      refresh().catch(console.error);
                    }}
                  >
                    {category.isActive ? "Pasif Yap" : "Aktif Yap"}
                  </Button>
                  {!category.isDefault ? (
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await api.deleteCategory(category.id);
                          setMessage("Kategori silindi.");
                          setDeleteBlockInfo(null);
                          refresh().catch(console.error);
                        } catch (error) {
                          if (error instanceof ApiError && api.isDeleteCategoryBlockedPayload(error.payload)) {
                            setDeleteBlockInfo(error.payload);
                            setMessage(error.message);
                          } else {
                            setDeleteBlockInfo(null);
                            setMessage(error instanceof Error ? error.message : "Bir hata olustu.");
                          }
                        }
                      }}
                    >
                      Sil
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
