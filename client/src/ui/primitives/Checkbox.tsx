import * as CheckboxPrimitive from '@kobalte/core/checkbox';
import Check from 'lucide-solid/icons/check';
import { Show, type Component } from 'solid-js';

import { cn } from '../lib/cn';

interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  class?: string;
  onChange?: (checked: boolean) => void;
}

export const Checkbox: Component<CheckboxProps> = (props) => {
  return (
    <CheckboxPrimitive.Root
      checked={props.checked}
      class={cn('ui-checkbox', props.class)}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      onChange={props.onChange}
    >
      <CheckboxPrimitive.Input />
      <CheckboxPrimitive.Control class="ui-checkbox__control">
        <CheckboxPrimitive.Indicator class="ui-checkbox__indicator">
          <Check aria-hidden="true" size={14} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
      <span>
        <CheckboxPrimitive.Label>{props.label}</CheckboxPrimitive.Label>
        <Show when={props.description}>
          <CheckboxPrimitive.Description class="ui-field__description">
            {props.description}
          </CheckboxPrimitive.Description>
        </Show>
      </span>
    </CheckboxPrimitive.Root>
  );
};
