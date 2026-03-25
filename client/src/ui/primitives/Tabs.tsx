import * as KTabs from '@kobalte/core/tabs';
import type { ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Tabs = {
  Root: (props: WrapperProps) => <KTabs.Root {...(props as unknown as KTabs.TabsRootProps)} class={cn('ui-tabs', props.class)}>{props.children}</KTabs.Root>,
  List: (props: WrapperProps) => <KTabs.List {...(props as unknown as KTabs.TabsListProps)} class={cn('ui-tabs__list', props.class)}>{props.children}</KTabs.List>,
  Trigger: (props: WrapperProps) => (
    <KTabs.Trigger {...(props as unknown as KTabs.TabsTriggerProps)} class={cn('ui-tabs__trigger', props.class)}>
      {props.children}
    </KTabs.Trigger>
  ),
  Content: (props: WrapperProps) => (
    <KTabs.Content {...(props as unknown as KTabs.TabsContentProps)} class={cn('ui-tabs__content', props.class)}>
      {props.children}
    </KTabs.Content>
  ),
};
