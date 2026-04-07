import * as KDialog from '@kobalte/core/dialog';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Dialog = {
  Root: (props: WrapperProps) => (
    <KDialog.Root {...(props as KDialog.DialogRootProps)}>
      {props.children}
    </KDialog.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <KDialog.Trigger
      {...(props as KDialog.DialogTriggerProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </KDialog.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <KDialog.Portal>{props.children}</KDialog.Portal>
  ),
  Overlay: (props: WrapperProps) => (
    <KDialog.Overlay
      {...(props as KDialog.DialogOverlayProps)}
      class={cn('ui-dialog__overlay', props.class)}
    />
  ),
  Content: (props: WrapperProps) => (
    <KDialog.Content
      {...(props as KDialog.DialogContentProps)}
      class={cn('ui-dialog__content', props.class)}
    >
      {props.children}
    </KDialog.Content>
  ),
  Title: (props: WrapperProps) => (
    <KDialog.Title {...(props as KDialog.DialogTitleProps)}>
      {props.children}
    </KDialog.Title>
  ),
  Description: (props: WrapperProps) => (
    <KDialog.Description
      {...(props as KDialog.DialogDescriptionProps)}
      class={cn('ui-subtitle', props.class)}
    >
      {props.children}
    </KDialog.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <KDialog.CloseButton
      {...(props as KDialog.DialogCloseButtonProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </KDialog.CloseButton>
  ),
};
