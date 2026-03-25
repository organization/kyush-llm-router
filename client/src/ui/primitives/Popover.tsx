import * as KPopover from '@kobalte/core/popover';
import type { ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Popover = {
  Root: (props: WrapperProps) => <KPopover.Root {...(props as KPopover.PopoverRootProps)}>{props.children}</KPopover.Root>,
  Trigger: (props: WrapperProps) => (
    <KPopover.Trigger {...(props as KPopover.PopoverTriggerProps)} class={cn('ui-button', props.class)}>
      {props.children}
    </KPopover.Trigger>
  ),
  Portal: (props: WrapperProps) => <KPopover.Portal>{props.children}</KPopover.Portal>,
  Content: (props: WrapperProps) => (
    <KPopover.Content {...(props as KPopover.PopoverContentProps)} class={cn('ui-popover__content', props.class)}>
      {props.children}
    </KPopover.Content>
  ),
  Title: (props: WrapperProps) => <KPopover.Title {...(props as KPopover.PopoverTitleProps)}>{props.children}</KPopover.Title>,
  Description: (props: WrapperProps) => (
    <KPopover.Description {...(props as KPopover.PopoverDescriptionProps)} class={cn('ui-subtitle', props.class)}>
      {props.children}
    </KPopover.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <KPopover.CloseButton {...(props as KPopover.PopoverCloseButtonProps)} class={cn('ui-button', props.class)}>
      {props.children}
    </KPopover.CloseButton>
  ),
};
