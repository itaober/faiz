'use client';

import { CheckIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { createContext, forwardRef, useCallback, useContext, useId, useState } from 'react';

import { cn } from '@/lib/utils';

interface ICheckboxContext {
  checked: boolean;
  disabled?: boolean;
  readonly?: boolean;
  /** Ties CheckboxLabel's text to the checkbox button as its accessible name. */
  labelId: string;
  onToggle: () => void;
}

const CheckboxContext = createContext<ICheckboxContext>({
  checked: false,
  disabled: false,
  readonly: false,
  labelId: '',
  onToggle: () => {},
});

function useCheckboxContext() {
  const context = useContext(CheckboxContext);
  if (!context) {
    throw new Error('Checkbox components must be used within CheckboxRoot');
  }
  return context;
}

export interface ICheckboxRootProps {
  checked?: boolean;
  readonly?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const CheckboxRoot = forwardRef<HTMLDivElement, ICheckboxRootProps>(
  (
    {
      className,
      checked,
      readonly,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const labelId = useId();

    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const onToggle = useCallback(() => {
      if (disabled || readonly) return;

      const newChecked = !isChecked;

      if (!isControlled) {
        setInternalChecked(newChecked);
      }

      onCheckedChange?.(newChecked);
    }, [isChecked, disabled, readonly, isControlled, onCheckedChange]);

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2', className)}
        data-state={isChecked ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readonly ? '' : undefined}
        {...props}
      >
        <CheckboxContext.Provider
          value={{ checked: isChecked, disabled, readonly, labelId, onToggle }}
        >
          {children}
        </CheckboxContext.Provider>
      </div>
    );
  },
);

CheckboxRoot.displayName = 'CheckboxRoot';

export interface ICheckboxProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

const Checkbox = forwardRef<HTMLButtonElement, ICheckboxProps>(({ className, ...props }, ref) => {
  const { checked, disabled, labelId, onToggle } = useCheckboxContext();

  return (
    // biome-ignore lint/a11y/useSemanticElements: styled design-system checkbox; a focusable button with aria-checked and Enter/Space handling implements the same contract
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-labelledby={labelId || undefined}
      data-state={checked ? 'checked' : 'unchecked'}
      data-disabled={disabled ? '' : undefined}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'pressable flex size-4 items-center justify-center rounded border-[1.5px] transition-[transform,opacity,border-color,background-color] duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-ring',
        'opacity-60 hover:opacity-80 data-[disabled]:opacity-50 data-[state=checked]:opacity-100',
        className,
      )}
      {...props}
    >
      <CheckIcon
        strokeWidth={5}
        className={cn(
          'text-foreground size-2.5 opacity-0 transition-[opacity,transform] duration-100',
          {
            'opacity-100': checked,
          },
        )}
      />
    </button>
  );
});

Checkbox.displayName = 'Checkbox';

export interface CheckboxLabelProps extends HTMLAttributes<HTMLSpanElement> {}

// A <span>, not a <label>: it names the sibling button via aria-labelledby, and
// label/htmlFor cannot target a button.
const CheckboxLabel = forwardRef<HTMLSpanElement, CheckboxLabelProps>(
  ({ className, ...props }, ref) => {
    const { checked, disabled, labelId, onToggle } = useCheckboxContext();

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: click-to-toggle is a hit-area convenience; the keyboard path is the checkbox button this labels
      // biome-ignore lint/a11y/useKeyWithClickEvents: same — the button next to it handles Enter/Space
      <span
        id={labelId || undefined}
        data-state={checked ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        ref={ref}
        className={cn('data-[disabled]:opacity-50 data-[state=checked]:opacity-100', className)}
        onClick={onToggle}
        {...props}
      />
    );
  },
);

CheckboxLabel.displayName = 'CheckboxLabel';

export { Checkbox, CheckboxLabel, CheckboxRoot };
