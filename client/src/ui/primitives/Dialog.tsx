import * as DialogPrimitive from '@kobalte/core/dialog';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Dialog = {
  Root: (props: WrapperProps) => (
    <DialogPrimitive.Root {...(props as DialogPrimitive.DialogRootProps)}>
      {props.children}
    </DialogPrimitive.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <DialogPrimitive.Trigger
      {...(props as DialogPrimitive.DialogTriggerProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </DialogPrimitive.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <DialogPrimitive.Portal>{props.children}</DialogPrimitive.Portal>
  ),
  Overlay: (props: WrapperProps) => (
    <DialogPrimitive.Overlay
      {...(props as DialogPrimitive.DialogOverlayProps)}
      class={cn('ui-dialog__overlay', props.class)}
    />
  ),
  Content: (props: WrapperProps) => (
    <DialogPrimitive.Content
      {...(props as DialogPrimitive.DialogContentProps)}
      class={cn('ui-dialog__content', props.class)}
    >
      {props.children}
    </DialogPrimitive.Content>
  ),
  Title: (props: WrapperProps) => (
    <DialogPrimitive.Title {...(props as DialogPrimitive.DialogTitleProps)}>
      {props.children}
    </DialogPrimitive.Title>
  ),
  Description: (props: WrapperProps) => (
    <DialogPrimitive.Description
      {...(props as DialogPrimitive.DialogDescriptionProps)}
      class={cn('ui-subtitle', props.class)}
    >
      {props.children}
    </DialogPrimitive.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <DialogPrimitive.CloseButton
      {...(props as DialogPrimitive.DialogCloseButtonProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </DialogPrimitive.CloseButton>
  ),
};
