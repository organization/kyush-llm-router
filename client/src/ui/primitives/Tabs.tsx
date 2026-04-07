import * as TabsPrimitive from '@kobalte/core/tabs';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Tabs = {
  Root: (props: WrapperProps) => (
    <TabsPrimitive.Root
      {...(props as unknown as TabsPrimitive.TabsRootProps)}
      class={cn('ui-tabs', props.class)}
    >
      {props.children}
    </TabsPrimitive.Root>
  ),
  List: (props: WrapperProps) => (
    <TabsPrimitive.List
      {...(props as unknown as TabsPrimitive.TabsListProps)}
      class={cn('ui-tabs__list', props.class)}
    >
      {props.children}
    </TabsPrimitive.List>
  ),
  Trigger: (props: WrapperProps) => (
    <TabsPrimitive.Trigger
      {...(props as unknown as TabsPrimitive.TabsTriggerProps)}
      class={cn('ui-tabs__trigger', props.class)}
    >
      {props.children}
    </TabsPrimitive.Trigger>
  ),
  Content: (props: WrapperProps) => (
    <TabsPrimitive.Content
      {...(props as unknown as TabsPrimitive.TabsContentProps)}
      class={cn('ui-tabs__content', props.class)}
    >
      {props.children}
    </TabsPrimitive.Content>
  ),
};
