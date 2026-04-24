export const API_BASE_URL =
  typeof window !== "undefined" && window.location.port === "3001"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export const TRANSACTION_TYPE_OPTIONS = [
  { label: "Gelir", value: "income" },
  { label: "Gider", value: "expense" },
] as const;

export const MONTH_NAMES_TR = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
];

