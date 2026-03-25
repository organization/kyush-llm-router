import type { JSX, ParentProps } from 'solid-js';
import { Button } from './Button';

interface IconButtonProps extends ParentProps, Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'class' | 'type' | 'onClick'> {
  icon: JSX.Element;
  label: JSX.Element;
  class?: string;
  variant?: 'neutral' | 'primary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function IconButton(props: IconButtonProps) {
  return (
    <Button
      {...props}
      class={['ui-button--icon', props.class].filter(Boolean).join(' ')}
      aria-label={typeof props.label === 'string' ? props.label : props['aria-label']}
    >
      <span class="ui-button__icon" aria-hidden="true">
        {props.icon}
      </span>
      <span class="ui-button__label">{props.label}</span>
    </Button>
  );
}
