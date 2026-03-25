import type { JSX, ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps extends ParentProps {
  title?: string;
  tone?: AlertTone;
  class?: string;
  actions?: JSX.Element;
}

export function Alert(props: AlertProps) {
  return (
    <div class={cn('ui-alert', `ui-alert--${props.tone ?? 'info'}`, props.class)} role="alert">
      {props.title && <strong>{props.title}</strong>}
      <div>{props.children}</div>
      {props.actions}
    </div>
  );
}
