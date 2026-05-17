'use client';

import { Drawer } from 'vaul';

interface IConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loadingLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

export default function ConfirmDrawer({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
  isLoading = false,
  onConfirm,
}: IConfirmDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="bg-foreground/40 fixed inset-0 z-30" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-30 rounded-t-xl outline-none">
          <div className="space-y-3 px-4 pt-5 pb-6">
            <Drawer.Title className="text-center text-sm font-medium">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="text-muted-foreground text-center text-sm">
                {description}
              </Drawer.Description>
            )}
            <div className="flex gap-4 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="pressable bg-muted hover:bg-muted/80 border-border flex-1 rounded-lg border px-4 py-3 transition-[transform,color,background-color,border-color,opacity]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="pressable border-danger bg-danger-soft text-danger flex-1 rounded-lg border px-4 py-3 transition-[transform,color,background-color,border-color,opacity] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? loadingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
