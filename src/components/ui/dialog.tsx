"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content className="dialog-content">
          <Primitive.Title className="dialog-title">{title}</Primitive.Title>
          <Primitive.Description className={description ? "muted" : "sr-only"}>
            {description || title}
          </Primitive.Description>
          <Primitive.Close
            className="dialog-close icon-button"
            aria-label="Close dialog"
          >
            <X size={18} />
          </Primitive.Close>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
