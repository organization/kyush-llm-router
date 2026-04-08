import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

export function FieldRow(props: ParentProps<{ class?: string }>) {
  return <div class={cn('ui-field-row', props.class)}>{props.children}</div>;
}
