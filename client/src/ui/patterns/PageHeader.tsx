import type { JSX, ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

interface PageHeaderProps extends ParentProps {
  title: string;
  description?: string;
  actions?: JSX.Element;
  class?: string;
}

export function PageHeader(props: PageHeaderProps) {
  return (
    <header class={cn('page-header', props.class)}>
      <div class="page-header__copy">
        <p class="page-header__eyebrow">Operations</p>
        <h2 class="page-header__title">{props.title}</h2>
        {props.description && <p class="page-header__description">{props.description}</p>}
        {props.children}
      </div>
      {props.actions && <div class="page-header__actions">{props.actions}</div>}
    </header>
  );
}
