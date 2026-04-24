import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const transactionFormSchema = z.object({
  date: z.string().min(1, "Tarih zorunludur."),
  description: z.string().min(2, "Aciklama en az 2 karakter olmalidir."),
  person: z.string().min(2, "Kisi alani zorunludur."),
  amount: z.number().positive("Tutar sifirdan buyuk olmalidir."),
  currencyCode: z.string().optional().or(z.literal("")),
  type: transactionTypeSchema,
  categoryId: z.string().min(1, "Kategori seciniz."),
  notes: z.string().max(500, "Not alani en fazla 500 karakter olabilir.").optional().or(z.literal("")),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Kategori adi en az 2 karakter olmalidir."),
  description: z.string().max(200, "Aciklama en fazla 200 karakter olabilir.").optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  workspaceName: z.string().min(2, "Uygulama adi en az 2 karakter olmalidir."),
  defaultCurrency: z.string().min(1, "Varsayilan para birimi seciniz."),
  backupDirectory: z.string().optional().or(z.literal("")),
  autoBackupIntervalHours: z
    .number()
    .int("Saat degeri tam sayi olmalidir.")
    .min(1, "Otomatik yedek suresi en az 1 saat olmalidir.")
    .max(24 * 365, "Otomatik yedek suresi en fazla 8760 saat olabilir."),
  driveEnabled: z.boolean(),
  driveClientId: z.string().optional().or(z.literal("")),
  driveClientSecret: z.string().optional().or(z.literal("")),
  driveFolderName: z.string().optional().or(z.literal("")),
});

export const transactionFiltersSchema = z.object({
  month: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.string().optional(),
  query: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
