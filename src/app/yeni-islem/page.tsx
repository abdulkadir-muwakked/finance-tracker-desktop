import { TransactionForm } from "@/components/forms/transaction-form";
import { PageHeader } from "@/components/layout/page-header";

export default function NewTransactionPage() {
  return (
    <div>
      <PageHeader
        title="Yeni Islem"
        description="Gelir veya gider kaydini hizlica olusturun. Form, ofis kullanimina uygun sade ve hizli veri girisi icin tasarlandi."
      />
      <TransactionForm />
    </div>
  );
}

