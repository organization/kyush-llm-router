import { For } from 'solid-js';

export interface MetaItem {
  key: string;
  value: string;
}

interface MetaClusterProps {
  items: MetaItem[];
}

export function MetaCluster(props: MetaClusterProps) {
  return (
    <div class="meta-cluster">
      <For each={props.items}>
        {(item) => (
          <>
            <span class="meta-key">{item.key}</span>
            <span class="meta-value" title={item.value}>
              {item.value}
            </span>
          </>
        )}
      </For>
    </div>
  );
}
