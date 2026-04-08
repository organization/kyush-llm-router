import { cn } from '../lib/cn';

import type { JSX, ParentProps } from 'solid-js';

export function CommandBar(props: ParentProps<{ class?: string }>) {
  return <div class={cn('ui-command-bar', props.class)}>{props.children}</div>;
}

export function CommandBarGroup(props: ParentProps<{ class?: string }>) {
  return (
    <div class={cn('ui-command-bar__group', props.class)}>{props.children}</div>
  );
}

export function CommandBarHint(props: {
  children: JSX.Element;
  class?: string;
}) {
  return (
    <span class={cn('ui-command-bar__hint', props.class)}>
      {props.children}
    </span>
  );
}
