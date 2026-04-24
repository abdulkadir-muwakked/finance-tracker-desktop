"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { settingsSchema, type SettingsFormValues } from "@/lib/schemas";
import type { Currency, SettingsData } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SettingsView() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [message, setMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [driveMessage, setDriveMessage] = useState("");
  const [backupPreset, setBackupPreset] = useState<"daily" | "weekly" | "custom">("weekly");

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
      defaultValues: {
        workspaceName: "",
        defaultCurrency: "TRY",
        backupDirectory: "",
        autoBackupIntervalHours: 168,
        driveEnabled: false,
        driveClientId: "",
        driveClientSecret: "",
        driveFolderName: "Finans Takip Backups",
      },
    });

  useEffect(() => {
    Promise.all([api.getSettings(), api.getCurrencies()])
      .then(([settingsData, currenciesData]) => {
        setSettings(settingsData);
        setCurrencies(currenciesData);
        form.reset({
          workspaceName: settingsData.workspaceName,
          defaultCurrency: settingsData.defaultCurrency,
          backupDirectory: settingsData.backupDirectory,
          autoBackupIntervalHours: settingsData.autoBackupIntervalHours,
          driveEnabled: settingsData.driveEnabled,
          driveClientId: settingsData.driveClientId,
          driveClientSecret: "",
          driveFolderName: settingsData.driveFolderName,
        });
        setBackupPreset(
          settingsData.autoBackupIntervalHours === 24
            ? "daily"
            : settingsData.autoBackupIntervalHours === 168
              ? "weekly"
              : "custom",
        );
      })
      .catch(console.error);
  }, [form]);

  const autoBackupIntervalHours = form.watch("autoBackupIntervalHours");

  return (
    <div>
      <PageHeader
        title="Temel Ayarlar"
        description="Lokal masaustu uygulamasi icin temel varsayimlari ve veritabani konumunu yonetin."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Genel ayarlar</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  const updated = await api.updateSettings(values);
                  setSettings(updated);
                  setMessage("Ayarlar kaydedildi.");
                  setDriveMessage("Drive ayarlari guncellendi.");
                  window.dispatchEvent(
                    new CustomEvent("workspace-name-updated", {
                      detail: updated.workspaceName,
                    }),
                  );
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Bir hata olustu.");
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Uygulama adi</Label>
                <Input id="workspaceName" {...form.register("workspaceName")} />
              </div>
              <div className="space-y-2">
                <Label>Varsayilan para birimi</Label>
                <Select value={form.watch("defaultCurrency")} onValueChange={(value) => form.setValue("defaultCurrency", value)}>
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
                <Label htmlFor="backupDirectory">Yedek klasoru</Label>
                <Input
                  id="backupDirectory"
                  placeholder={settings?.defaultBackupDirectory || "Yedek klasor yolu"}
                  {...form.register("backupDirectory")}
                />
                <p className="text-xs text-muted-foreground">
                  Bos birakirsan varsayilan klasor kullanilir.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Otomatik yedek sikligi</Label>
                <Select
                  value={backupPreset}
                  onValueChange={(value) => {
                    const preset = value as "daily" | "weekly" | "custom";
                    setBackupPreset(preset);
                    if (preset === "daily") {
                      form.setValue("autoBackupIntervalHours", 24, { shouldValidate: true });
                    } else if (preset === "weekly") {
                      form.setValue("autoBackupIntervalHours", 168, { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Siklik secin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Gunluk</SelectItem>
                    <SelectItem value="weekly">Haftalik</SelectItem>
                    <SelectItem value="custom">Ozel saat araligi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {backupPreset === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="autoBackupIntervalHours">Ozel aralik (saat)</Label>
                  <Input
                    id="autoBackupIntervalHours"
                    type="number"
                    min={1}
                    max={24 * 365}
                    {...form.register("autoBackupIntervalHours", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orn. `12` her 12 saatte bir, `48` iki gunde bir kontrol eder.
                  </p>
                  <p className="text-xs text-destructive">
                    {form.formState.errors.autoBackupIntervalHours?.message}
                  </p>
                </div>
              ) : null}
              <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Google Drive yedekleme</p>
                    <p className="text-xs text-muted-foreground">
                      Yerel yedekten sonra Drive&apos;a da yukle.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.watch("driveEnabled")}
                    onChange={(event) => form.setValue("driveEnabled", event.target.checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driveClientId">Google Client ID</Label>
                  <Input id="driveClientId" {...form.register("driveClientId")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driveClientSecret">Google Client Secret</Label>
                  <Input
                    id="driveClientSecret"
                    type="password"
                    placeholder={settings?.driveClientSecretConfigured ? "Kayitli secret degistirmek icin yeni deger girin" : ""}
                    {...form.register("driveClientSecret")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings?.driveClientSecretConfigured
                      ? "Mevcut secret gizli tutulur. Degistirmek istemiyorsaniz bos birakin."
                      : "Ilk baglanti icin Google Client Secret girin."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driveFolderName">Drive klasor adi</Label>
                  <Input id="driveFolderName" {...form.register("driveFolderName")} />
                  <p className="text-xs text-muted-foreground">
                    Bu adla bir klasor bulunur veya otomatik olusturulur.
                  </p>
                </div>
              </div>

              <Button type="submit">Ayarlari Kaydet</Button>
              <p className="text-sm text-muted-foreground">{message || "Bu ayarlar yeni kayitlar ve genel gorunum icin kullanilir."}</p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sistem bilgisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-muted/70 p-4">
              <p className="text-sm text-muted-foreground">Veritabani konumu</p>
              <p className="mt-2 font-mono text-sm">{settings?.databasePath || "Gelistirme modunda API baslatildiginda olusturulur."}</p>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4">
              <p className="text-sm text-muted-foreground">Kurulum notu</p>
              <p className="mt-2 text-sm leading-6">
                Paketlenmis Electron surumu, Node.js kurulumu olmadan ofis bilgisayarinda calisir. Veriler ayni makinede saklanir.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Yedekleme</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/70 p-4">
                <p className="text-sm text-muted-foreground">Yedek klasoru</p>
                <p className="mt-2 font-mono text-sm">{settings?.backupDirectory || "Yedek klasoru henuz hazir degil."}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Son yedek</p>
                  <p className="mt-2 text-sm font-medium">
                    {settings?.lastBackupAt ? formatDateTime(settings.lastBackupAt) : "Henuz yedek alinmadi"}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Mevcut yedek sayisi</p>
                  <p className="mt-2 text-sm font-medium">{settings?.backupCount ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Saklama kurali</p>
                  <p className="mt-2 text-sm font-medium">
                    Son {settings?.backupRetentionCount ?? 5} yedek tutulur
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                Uygulama, son basarili yedekten sonra {settings?.autoBackupIntervalHours ?? 168} saat gecmisse otomatik yedek alir.
                Bu kontrol acilista ve uygulama acik kaldigi surece saatlik araliklarla tekrar calisir.
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-5">
              <p className="text-sm font-medium">Manuel islem</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Istediginiz anda tek tikla yeni bir yerel yedek olusturun.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={async () => {
                  try {
                    const updated = await api.runBackup();
                    setSettings(updated);
                    setBackupMessage("Yeni yedek basariyla olusturuldu.");
                  } catch (error) {
                    setBackupMessage(error instanceof Error ? error.message : "Yedek olusturulamadi.");
                  }
                }}
              >
                Yedek Al
              </Button>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={async () => {
                  try {
                    await api.openBackupFolder();
                    setBackupMessage("Yedek klasoru acildi.");
                  } catch (error) {
                    setBackupMessage(error instanceof Error ? error.message : "Klasor acilamadi.");
                  }
                }}
              >
                Klasoru Ac
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                {backupMessage ||
                  (settings?.lastBackupFile
                    ? `Son dosya: ${settings.lastBackupFile}`
                    : "Ilk yedegi almak icin butonu kullanin.")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Aktif ayar: {autoBackupIntervalHours || settings?.autoBackupIntervalHours || 168} saat
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Google Drive</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/70 p-4">
                <p className="text-sm text-muted-foreground">Bagli hesap</p>
                <p className="mt-2 text-sm font-medium">
                  {settings?.driveConnectedEmail || "Henuz hesap baglanmadi"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Drive durumu</p>
                  <p className="mt-2 text-sm font-medium">
                    {settings?.driveEnabled ? "Acik" : "Kapali"}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Son yukleme</p>
                  <p className="mt-2 text-sm font-medium">
                    {settings?.driveLastUploadAt ? formatDateTime(settings.driveLastUploadAt) : "Henuz yuklenmedi"}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm text-muted-foreground">Drive klasoru</p>
                  <p className="mt-2 text-sm font-medium">{settings?.driveFolderName || "Finans Takip Backups"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                Once ayarlari kaydedin. Ardindan `Google ile Baglan` ile tarayicida izin verin. Daha sonra istediginiz zaman hesap degistirmek icin `Baglantiyi Kes` ve tekrar baglan kullanabilirsiniz.
              </div>
              {settings?.driveLastUploadError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  Son Drive hatasi: {settings.driveLastUploadError}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-5">
              <p className="text-sm font-medium">Baglanti islemleri</p>
              <Button
                className="mt-4 w-full"
                onClick={async () => {
                  try {
                    const result = await api.startDriveConnect();
                    setDriveMessage("Google giris sayfasi yeni sekmede aciliyor.");
                    window.open(result.authUrl, "_blank", "noopener,noreferrer");
                  } catch (error) {
                    setDriveMessage(error instanceof Error ? error.message : "Drive baglantisi baslatilamadi.");
                  }
                }}
              >
                Google ile Baglan
              </Button>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={async () => {
                  try {
                    const updated = await api.disconnectDrive();
                    setSettings(updated);
                    setDriveMessage("Google Drive baglantisi kaldirildi.");
                  } catch (error) {
                    setDriveMessage(error instanceof Error ? error.message : "Baglanti kaldirilamadi.");
                  }
                }}
              >
                Baglantiyi Kes
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                {settings?.driveLastUploadFile
                  ? `Son yuklenen dosya: ${settings.driveLastUploadFile}`
                  : "Baglandiktan sonra yeni yedekler otomatik yuklenir."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {driveMessage || "Baglanmak icin once Google OAuth bilgilerini kaydedin."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
