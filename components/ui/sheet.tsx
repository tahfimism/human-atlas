'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  modal?: boolean;
  disablePointerDismissal?: boolean;
}

const SheetContext = React.createContext<{
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}>({ open: false });

function Sheet({ open = false, onOpenChange, children }: SheetProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

function SheetTrigger({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(SheetContext);
  return (
    <button
      type="button"
      data-slot="sheet-trigger"
      onClick={(e) => {
        onClick?.(e);
        onOpenChange?.(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function SheetClose({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(SheetContext);
  return (
    <button
      type="button"
      data-slot="sheet-close"
      onClick={(e) => {
        onClick?.(e);
        onOpenChange?.(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  initialFocus,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
  initialFocus?: React.RefObject<any>;
}) {
  const { open, onOpenChange } = React.useContext(SheetContext);
  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      data-slot="sheet-content"
      data-side={side}
      className={cn(
        'bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out',
        'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button
          variant="ghost"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          size="icon-sm"
          onClick={() => onOpenChange?.(false)}
          title="Close inspector"
        >
          <XIcon size={16} />
          <span className="sr-only">Close</span>
        </Button>
      )}
    </aside>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('gap-0.5 p-4 flex flex-col', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('gap-2 p-4 mt-auto flex flex-col', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn(
        'text-foreground text-base font-medium cn-font-heading',
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
