import * as SelectPrimitive from '@kobalte/core/select';
import Check from 'lucide-solid/icons/check';
import ChevronDown from 'lucide-solid/icons/chevron-down';
import { Show, type Component } from 'solid-js';

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

export const Select: Component<SelectProps> = (props) => {
  // Note: derive `selected` inline (no createMemo) — Solid's reactive primitives
  // already cache prop reads, and `find` over a typically tiny option list is
  // cheaper than the memo bookkeeping.
  const selected = () =>
    props.options.find((option) => option.value === props.value);

  return (
    <SelectPrimitive.Root<SelectOption>
      class={cn('ui-select', props.class)}
      itemComponent={(itemProps) => (
        <SelectPrimitive.Item class="ui-select__item" item={itemProps.item}>
          <SelectPrimitive.ItemLabel>
            {itemProps.item.rawValue.label}
          </SelectPrimitive.ItemLabel>
          <SelectPrimitive.ItemIndicator class="ui-select__item-indicator">
            <Check aria-hidden="true" size={14} />
          </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
      )}
      onChange={(option) => props.onChange?.(option?.value ?? '')}
      optionTextValue="label"
      optionValue="value"
      options={props.options}
      placeholder={props.placeholder ?? 'Select'}
      value={selected()}
    >
      <Show when={props.label}>
        <SelectPrimitive.Label class="ui-field__label">
          {props.label}
        </SelectPrimitive.Label>
      </Show>
      <SelectPrimitive.Trigger class="ui-select__trigger">
        <SelectPrimitive.Value<SelectOption> class="ui-select__value">
          {(state) =>
            state.selectedOption()?.label ?? props.placeholder ?? 'Select'
          }
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon class="ui-select__icon">
          <ChevronDown aria-hidden="true" size={14} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content class="ui-select__content">
          <SelectPrimitive.Listbox />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
