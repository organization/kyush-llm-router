import type { JSX, ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

interface PanelProps extends ParentProps {
  title?: string;
  description?: string;
  actions?: JSX.Element;
  class?: string;
  bodyClass?: string;
}

export function Panel(props: PanelProps) {
  return (
    <section class={cn('ui-panel', props.class)}>
      {(props.title || props.description || props.actions) && (
        <div class="ui-panel__header">
          <div class="ui-panel__header-copy">
            {props.title && <h3 class="ui-panel__title">{props.title}</h3>}
            {props.description && <p class="ui-subtitle">{props.description}</p>}
          </div>
          {props.actions}
        </div>
      )}
      <div class={cn('ui-panel__body', props.bodyClass)}>{props.children}</div>
    </section>
  );
}
