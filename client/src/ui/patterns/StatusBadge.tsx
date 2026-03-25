import { cn } from '../lib/cn';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  tone?: StatusTone;
  children: string;
  class?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  return <span class={cn('ui-badge', `ui-badge--${props.tone ?? 'neutral'}`, props.class)}>{props.children}</span>;
}
