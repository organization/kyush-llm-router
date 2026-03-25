import * as KSwitch from '@kobalte/core/switch';
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
    <KSwitch.Root
      class={cn('ui-switch', props.class)}
      checked={props.checked}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      onChange={props.onChange}
    >
      <KSwitch.Input />
      <KSwitch.Control class="ui-switch__control">
        <KSwitch.Thumb class="ui-switch__thumb" />
      </KSwitch.Control>
      <span>
        <KSwitch.Label>{props.label}</KSwitch.Label>
        {props.description && <KSwitch.Description class="ui-field__description">{props.description}</KSwitch.Description>}
      </span>
    </KSwitch.Root>
  );
}
