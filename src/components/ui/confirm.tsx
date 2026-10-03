"use client";
import { AlertDialog } from "radix-ui";
import { Button } from "./button";
export function Confirm({
  children,
  title,
  onConfirm,
}: {
  children: React.ReactNode;
  title: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="dialog-title">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="muted">
            This action cannot be undone.
          </AlertDialog.Description>
          <div className="form-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={onConfirm}>
                Confirm
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
