import * as KTooltip from '@kobalte/core/tooltip';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Tooltip = {
  Root: (props: WrapperProps) => (
    <KTooltip.Root openDelay={150} {...(props as KTooltip.TooltipRootProps)}>
      {props.children}
    </KTooltip.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <KTooltip.Trigger
      {...(props as KTooltip.TooltipTriggerProps)}
      class={props.class}
    >
      {props.children}
    </KTooltip.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <KTooltip.Portal>{props.children}</KTooltip.Portal>
  ),
  Content: (props: WrapperProps) => (
    <KTooltip.Content
      {...(props as KTooltip.TooltipContentProps)}
      class={cn('ui-tooltip__content', props.class)}
    >
      {props.children}
    </KTooltip.Content>
  ),
  Arrow: (props: WrapperProps) => (
    <KTooltip.Arrow {...(props as KTooltip.TooltipArrowProps)} />
  ),
};
