import { MONTH_NAMES_TR } from "./constants";

export function formatCurrency(value: number, currencyCode = "TRY") {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getMonthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

export function getPreviousMonthInputValue(date = new Date()) {
  return getMonthInputValue(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function getMonthLabel(monthInput: string) {
  const [year, month] = monthInput.split("-").map(Number);
  return `${MONTH_NAMES_TR[month - 1]} ${year}`;
}

export function formatMonthYear(year: number, month: number) {
  return `${MONTH_NAMES_TR[month - 1]} ${year}`;
}
