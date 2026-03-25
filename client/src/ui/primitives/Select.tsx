import * as KSelect from '@kobalte/core/select';
import { Show, createMemo } from 'solid-js';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  label?: string;
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  class?: string;
  onChange?: (value: string) => void;
}

export function Select(props: SelectProps) {
  const selected = createMemo(() => props.options.find((option) => option.value === props.value));

  return (
    <KSelect.Root<SelectOption>
      class={cn('ui-select', props.class)}
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      value={selected()}
      placeholder={props.placeholder ?? 'Select'}
      onChange={(option) => props.onChange?.(option?.value ?? '')}
      itemComponent={(itemProps) => (
        <KSelect.Item item={itemProps.item} class="ui-select__item">
          <KSelect.ItemLabel>{itemProps.item.rawValue.label}</KSelect.ItemLabel>
          <KSelect.ItemIndicator>✓</KSelect.ItemIndicator>
        </KSelect.Item>
      )}
    >
      <Show when={props.label}>
        <KSelect.Label class="ui-field__label">{props.label}</KSelect.Label>
      </Show>
      <KSelect.Trigger class="ui-select__trigger">
        <KSelect.Value<SelectOption> class="ui-select__value">
          {(state) => state.selectedOption()?.label ?? props.placeholder ?? 'Select'}
        </KSelect.Value>
        <KSelect.Icon>▾</KSelect.Icon>
      </KSelect.Trigger>
      <KSelect.Portal>
        <KSelect.Content class="ui-select__content">
          <KSelect.Listbox />
        </KSelect.Content>
      </KSelect.Portal>
    </KSelect.Root>
  );
}
