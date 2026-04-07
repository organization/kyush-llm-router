import * as TextFieldPrimitive from '@kobalte/core/text-field';

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
    <TextFieldPrimitive.Root
      class={cn('ui-field', props.class)}
      validationState={props.errorMessage ? 'invalid' : 'valid'}
    >
      <TextFieldPrimitive.Label class="ui-field__label">
        {props.label}
      </TextFieldPrimitive.Label>
      <div class="ui-field__control-row">
        <div class="ui-field__control-fill">
          {props.multiline ? (
            <TextFieldPrimitive.TextArea
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
            <TextFieldPrimitive.Input
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
        <TextFieldPrimitive.Description class="ui-field__description">
          {props.description}
        </TextFieldPrimitive.Description>
      )}
      {props.errorMessage && (
        <TextFieldPrimitive.ErrorMessage class="ui-field__error">
          {props.errorMessage}
        </TextFieldPrimitive.ErrorMessage>
      )}
    </TextFieldPrimitive.Root>
  );
}
