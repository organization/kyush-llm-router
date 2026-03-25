import type { JSX, ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type ButtonVariant = 'neutral' | 'primary' | 'danger';

interface ButtonProps extends ParentProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  class?: string;
  disabled?: boolean;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function Button(props: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      class={cn(
        'ui-button',
        props.variant === 'primary' && 'ui-button--primary',
        props.variant === 'danger' && 'ui-button--danger',
        props.class,
      )}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
