import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions/transactions-view";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Yukleniyor...</div>}>
      <TransactionsView />
    </Suspense>
  );
}
