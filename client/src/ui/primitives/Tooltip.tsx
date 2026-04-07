import * as TooltipPrimitive from '@kobalte/core/tooltip';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Tooltip = {
  Root: (props: WrapperProps) => (
    <TooltipPrimitive.Root
      openDelay={150}
      {...(props as TooltipPrimitive.TooltipRootProps)}
    >
      {props.children}
    </TooltipPrimitive.Root>
  ),
  Trigger: (props: WrapperProps) => (
    <TooltipPrimitive.Trigger
      {...(props as TooltipPrimitive.TooltipTriggerProps)}
      class={props.class}
    >
      {props.children}
    </TooltipPrimitive.Trigger>
  ),
  Portal: (props: WrapperProps) => (
    <TooltipPrimitive.Portal>{props.children}</TooltipPrimitive.Portal>
  ),
  Content: (props: WrapperProps) => (
    <TooltipPrimitive.Content
      {...(props as TooltipPrimitive.TooltipContentProps)}
      class={cn('ui-tooltip__content', props.class)}
    >
      {props.children}
    </TooltipPrimitive.Content>
  ),
  Arrow: (props: WrapperProps) => (
    <TooltipPrimitive.Arrow
      {...(props as TooltipPrimitive.TooltipArrowProps)}
    />
  ),
};
