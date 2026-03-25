import * as KDropdownMenu from '@kobalte/core/dropdown-menu';
import type { ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const DropdownMenu = {
  Root: (props: WrapperProps) => <KDropdownMenu.Root {...(props as KDropdownMenu.DropdownMenuRootProps)}>{props.children}</KDropdownMenu.Root>,
  Trigger: (props: WrapperProps) => (
    <KDropdownMenu.Trigger {...(props as KDropdownMenu.DropdownMenuTriggerProps)} class={cn('ui-button', props.class)}>
      {props.children}
    </KDropdownMenu.Trigger>
  ),
  Portal: (props: WrapperProps) => <KDropdownMenu.Portal>{props.children}</KDropdownMenu.Portal>,
  Content: (props: WrapperProps) => (
    <KDropdownMenu.Content {...(props as KDropdownMenu.DropdownMenuContentProps)} class={cn('ui-dropdown__content', props.class)}>
      {props.children}
    </KDropdownMenu.Content>
  ),
  Item: (props: WrapperProps) => (
    <KDropdownMenu.Item {...(props as KDropdownMenu.DropdownMenuItemProps)} class={cn('ui-dropdown__item', props.class)}>
      {props.children}
    </KDropdownMenu.Item>
  ),
  Separator: (props: WrapperProps) => (
    <KDropdownMenu.Separator {...(props as KDropdownMenu.DropdownMenuSeparatorProps)} class={cn('ui-dropdown__separator', props.class)} />
  ),
};
