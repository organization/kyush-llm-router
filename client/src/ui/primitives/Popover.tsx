import * as PopoverPrimitive from '@kobalte/core/popover';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Popover = {
  Root: (props: WrapperProps) => (
    <PopoverPrimitive.Root {...(props as PopoverPrimitive.PopoverRootProps)}>
      {props.children}
    </PopoverPrimitive.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <PopoverPrimitive.Trigger
      {...(props as PopoverPrimitive.PopoverTriggerProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </PopoverPrimitive.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <PopoverPrimitive.Portal>{props.children}</PopoverPrimitive.Portal>
  ),
  Content: (props: WrapperProps) => (
    <PopoverPrimitive.Content
      {...(props as PopoverPrimitive.PopoverContentProps)}
      class={cn('ui-popover__content', props.class)}
    >
      {props.children}
    </PopoverPrimitive.Content>
  ),
  Title: (props: WrapperProps) => (
    <PopoverPrimitive.Title {...(props as PopoverPrimitive.PopoverTitleProps)}>
      {props.children}
    </PopoverPrimitive.Title>
  ),
  Description: (props: WrapperProps) => (
    <PopoverPrimitive.Description
      {...(props as PopoverPrimitive.PopoverDescriptionProps)}
      class={cn('ui-subtitle', props.class)}
    >
      {props.children}
    </PopoverPrimitive.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <PopoverPrimitive.CloseButton
      {...(props as PopoverPrimitive.PopoverCloseButtonProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </PopoverPrimitive.CloseButton>
  ),
};
