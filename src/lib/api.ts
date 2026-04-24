import { API_BASE_URL } from "@/lib/constants";
import type {
  Category,
  Currency,
  DashboardData,
  DeleteCategoryBlockedPayload,
  MonthlyReportData,
  SettingsData,
  Transaction,
} from "@/lib/types";
import type {
  CategoryFormValues,
  SettingsFormValues,
  TransactionFormValues,
} from "@/lib/schemas";

export class ApiError extends Error {
  payload?: unknown;

  constructor(message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
  }
}

let sessionReadyPromise: Promise<void> | null = null;

async function ensureLocalSession() {
  if (typeof window === "undefined") {
    return;
  }

  if (!sessionReadyPromise) {
    sessionReadyPromise = fetch(`${API_BASE_URL}/api/session`, {
      method: "POST",
      credentials: "include",
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Yerel oturum baslatilamadi." }));
        throw new ApiError(data.message ?? "Yerel oturum baslatilamadi.", data);
      }
    }).catch((error) => {
      sessionReadyPromise = null;
      throw error;
    });
  }

  return sessionReadyPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureLocalSession();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: "Bir hata olustu." }));
    throw new ApiError(data.message ?? "Bir hata olustu.", data);
  }

  return response.json();
}

export const api = {
  getDashboard(month: string) {
    return request<DashboardData>(`/api/dashboard?month=${month}`);
  },
  getTransactions(params: URLSearchParams) {
    return request<Transaction[]>(`/api/transactions?${params.toString()}`);
  },
  getTransaction(id: string) {
    return request<Transaction>(`/api/transactions/${id}`);
  },
  createTransaction(payload: TransactionFormValues) {
    return request<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateTransaction(id: string, payload: TransactionFormValues) {
    return request<Transaction>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteTransaction(id: string) {
    return request<{ success: boolean }>(`/api/transactions/${id}`, {
      method: "DELETE",
    });
  },
  getCategories() {
    return request<Category[]>("/api/categories");
  },
  createCategory(payload: CategoryFormValues) {
    return request<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateCategory(id: string, payload: Partial<CategoryFormValues> & { isActive?: boolean }) {
    return request<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteCategory(id: string) {
    return request<{ success: boolean }>(`/api/categories/${id}`, {
      method: "DELETE",
    });
  },
  isDeleteCategoryBlockedPayload(payload: unknown): payload is DeleteCategoryBlockedPayload {
    return !!payload && typeof payload === "object" && "linkedTransactions" in payload;
  },
  getCurrencies() {
    return request<Currency[]>("/api/currencies");
  },
  getMonthlyReport(year: number, month: number) {
    return request<MonthlyReportData>(`/api/reports/monthly?year=${year}&month=${month}`);
  },
  getPeriodReport(params: URLSearchParams) {
    return request<MonthlyReportData>(`/api/reports/period?${params.toString()}`);
  },
  getSettings() {
    return request<SettingsData>("/api/settings");
  },
  updateSettings(payload: SettingsFormValues) {
    return request<SettingsData>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  startDriveConnect() {
    return request<{ success: boolean; authUrl: string }>("/api/drive/connect", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  disconnectDrive() {
    return request<SettingsData>("/api/drive/disconnect", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  runBackup() {
    return request<SettingsData>("/api/backups/run", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  openBackupFolder() {
    return request<{ success: boolean }>("/api/backups/open", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
