import type { ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

export function FieldRow(props: ParentProps<{ class?: string }>) {
  return <div class={cn('ui-field-row', props.class)}>{props.children}</div>;
}
