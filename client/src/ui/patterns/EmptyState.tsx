import type { JSX } from 'solid-js';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: JSX.Element;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <section class="panel-state">
      <h3 class="panel-state__title">{props.title}</h3>
      <p class="panel-state__description">{props.description}</p>
      {props.action}
    </section>
  );
}
