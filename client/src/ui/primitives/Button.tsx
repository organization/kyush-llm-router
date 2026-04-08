import { splitProps, type JSX, type ParentProps } from 'solid-js';

import { cn } from '../lib/cn';

type ButtonVariant = 'neutral' | 'primary' | 'danger';

interface ButtonProps
  extends ParentProps,
    Omit<
      JSX.ButtonHTMLAttributes<HTMLButtonElement>,
      'class' | 'type' | 'onClick'
    > {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  class?: string;
  disabled?: boolean;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    'children',
    'class',
    'disabled',
    'onClick',
    'type',
    'variant',
  ]);

  return (
    <button
      {...rest}
      class={cn(
        'ui-button',
        local.variant === 'primary' && 'ui-button--primary',
        local.variant === 'danger' && 'ui-button--danger',
        local.class,
      )}
      disabled={local.disabled}
      onClick={local.onClick}
      type={local.type ?? 'button'}
    >
      {local.children}
    </button>
  );
}
