"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export function AlertDialogContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-soft",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export const AlertDialogHeader = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="flex flex-col gap-2" {...props} />
);
export const AlertDialogFooter = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="mt-6 flex justify-end gap-3" {...props} />
);
export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;

