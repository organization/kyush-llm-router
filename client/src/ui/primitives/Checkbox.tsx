import * as KCheckbox from '@kobalte/core/checkbox';
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

export function Checkbox(props: CheckboxProps) {
  return (
    <KCheckbox.Root
      class={cn('ui-checkbox', props.class)}
      checked={props.checked}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      onChange={props.onChange}
    >
      <KCheckbox.Input />
      <KCheckbox.Control class="ui-checkbox__control">
        <KCheckbox.Indicator class="ui-checkbox__indicator">✓</KCheckbox.Indicator>
      </KCheckbox.Control>
      <span>
        <KCheckbox.Label>{props.label}</KCheckbox.Label>
        {props.description && <KCheckbox.Description class="ui-field__description">{props.description}</KCheckbox.Description>}
      </span>
    </KCheckbox.Root>
  );
}
