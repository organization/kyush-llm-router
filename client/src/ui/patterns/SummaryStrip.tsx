import { For } from 'solid-js';

export interface SummaryItem {
  label: string;
  value: string | number;
  hint?: string;
}

interface SummaryStripProps {
  items: SummaryItem[];
}

export function SummaryStrip(props: SummaryStripProps) {
  return (
    <section class="summary-strip">
      <For each={props.items}>
        {(item) => (
          <article class="summary-strip__item">
            <p class="summary-strip__label">{item.label}</p>
            <p class="summary-strip__value">{item.value}</p>
            <p class="summary-strip__hint">{item.hint ?? '\u00A0'}</p>
          </article>
        )}
      </For>
    </section>
  );
}
