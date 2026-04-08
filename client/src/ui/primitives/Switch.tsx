import * as SwitchPrimitive from '@kobalte/core/switch';

import { cn } from '../lib/cn';

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  class?: string;
  onChange?: (checked: boolean) => void;
}

export function Switch(props: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={props.checked}
      class={cn('ui-switch', props.class)}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      onChange={props.onChange}
    >
      <SwitchPrimitive.Input />
      <SwitchPrimitive.Control class="ui-switch__control">
        <SwitchPrimitive.Thumb class="ui-switch__thumb" />
      </SwitchPrimitive.Control>
      <span>
        <SwitchPrimitive.Label>{props.label}</SwitchPrimitive.Label>
        {props.description && (
          <SwitchPrimitive.Description class="ui-field__description">
            {props.description}
          </SwitchPrimitive.Description>
        )}
      </span>
    </SwitchPrimitive.Root>
  );
}
