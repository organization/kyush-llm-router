import * as DropdownMenuPrimitive from '@kobalte/core/dropdown-menu';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const DropdownMenu = {
  Root: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Root
      {...(props as DropdownMenuPrimitive.DropdownMenuRootProps)}
    >
      {props.children}
    </DropdownMenuPrimitive.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Trigger
      {...(props as DropdownMenuPrimitive.DropdownMenuTriggerProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </DropdownMenuPrimitive.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Portal>
      {props.children}
    </DropdownMenuPrimitive.Portal>
  ),
  Content: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Content
      {...(props as DropdownMenuPrimitive.DropdownMenuContentProps)}
      class={cn('ui-dropdown__content', props.class)}
    >
      {props.children}
    </DropdownMenuPrimitive.Content>
  ),
  Item: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Item
      {...(props as DropdownMenuPrimitive.DropdownMenuItemProps)}
      class={cn('ui-dropdown__item', props.class)}
    >
      {props.children}
    </DropdownMenuPrimitive.Item>
  ),
  Separator: (props: WrapperProps) => (
    <DropdownMenuPrimitive.Separator
      {...(props as DropdownMenuPrimitive.DropdownMenuSeparatorProps)}
      class={cn('ui-dropdown__separator', props.class)}
    />
  ),
};
