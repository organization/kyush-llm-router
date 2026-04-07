import * as KTextField from '@kobalte/core/text-field';

import { cn } from '../lib/cn';

import type { JSX, ParentProps } from 'solid-js';

interface TextFieldProps extends ParentProps {
  label: string;
  value?: string;
  type?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  multiline?: boolean;
  class?: string;
  onInput?: JSX.EventHandlerUnion<
    HTMLInputElement | HTMLTextAreaElement,
    InputEvent
  >;
}

export function TextField(props: TextFieldProps) {
  return (
    <KTextField.Root
      class={cn('ui-field', props.class)}
      validationState={props.errorMessage ? 'invalid' : 'valid'}
    >
      <KTextField.Label class="ui-field__label">{props.label}</KTextField.Label>
      <div class="ui-field__control-row">
        <div class="ui-field__control-fill">
          {props.multiline ? (
            <KTextField.TextArea
              class="ui-textarea"
              onInput={
                props.onInput as JSX.EventHandlerUnion<
                  HTMLTextAreaElement,
                  InputEvent
                >
              }
              placeholder={props.placeholder}
              value={props.value}
            />
          ) : (
            <KTextField.Input
              class="ui-input"
              onInput={
                props.onInput as JSX.EventHandlerUnion<
                  HTMLInputElement,
                  InputEvent
                >
              }
              placeholder={props.placeholder}
              type={props.type ?? 'text'}
              value={props.value}
            />
          )}
        </div>
        {props.children}
      </div>
      {props.description && (
        <KTextField.Description class="ui-field__description">
          {props.description}
        </KTextField.Description>
      )}
      {props.errorMessage && (
        <KTextField.ErrorMessage class="ui-field__error">
          {props.errorMessage}
        </KTextField.ErrorMessage>
      )}
    </KTextField.Root>
  );
}
