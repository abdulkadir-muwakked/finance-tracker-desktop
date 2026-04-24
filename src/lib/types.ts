export type Category = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  person: string;
  amount: number;
  currencyCode?: string | null;
  type: "income" | "expense";
  notes?: string | null;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  monthLabel: string;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
  overallTotals: {
    income: number;
    expense: number;
    net: number;
  };
  categoryDistribution: Array<{
    category: string;
    total: number;
  }>;
  recentTransactions: Transaction[];
};

export type MonthlyReportData = {
  periodType: "daily" | "monthly" | "yearly" | "all";
  periodLabel: string;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
  byCategory: Array<{
    category: string;
    income: number;
    expense: number;
    net: number;
  }>;
  dailyTrend: Array<{
    label: string;
    income: number;
    expense: number;
  }>;
};

export type ReportPeriodType = "daily" | "monthly" | "yearly" | "all";

export type DeleteCategoryBlockedPayload = {
  success: false;
  message: string;
  transactionCount: number;
  linkedTransactions: Array<{
    id: string;
    date: string;
    description: string;
    person: string;
    amount: number;
    type: "income" | "expense";
  }>;
};

export type SettingsData = {
  workspaceName: string;
  defaultCurrency: string;
  databasePath: string;
  backupDirectory: string;
  defaultBackupDirectory: string;
  backupRetentionCount: number;
  autoBackupIntervalDays: number;
  autoBackupIntervalHours: number;
  backupCount: number;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  lastBackupMode: string | null;
  driveEnabled: boolean;
  driveClientId: string;
  driveFolderName: string;
  driveClientSecretConfigured: boolean;
  driveConnectedEmail: string | null;
  driveLastUploadAt: string | null;
  driveLastUploadFile: string | null;
  driveLastUploadStatus: string | null;
  driveLastUploadError: string | null;
};
