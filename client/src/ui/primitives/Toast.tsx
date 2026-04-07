import * as ToastPrimitive from '@kobalte/core/toast';

import { cn } from '../lib/cn';

import type { ParentProps } from 'solid-js';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Toast = {
  Region: (props: WrapperProps) => (
    <ToastPrimitive.Region
      {...(props as ToastPrimitive.ToastRegionProps)}
      class={cn('ui-toast-region', props.class)}
    >
      {props.children}
    </ToastPrimitive.Region>
  ),
  List: (props: WrapperProps) => (
    <ToastPrimitive.List
      {...(props as ToastPrimitive.ToastListProps)}
      class={cn('ui-toast-list', props.class)}
    >
      {props.children}
    </ToastPrimitive.List>
  ),
  Root: (props: WrapperProps) => (
    <ToastPrimitive.Root
      {...(props as unknown as ToastPrimitive.ToastRootProps)}
      class={cn('ui-toast', props.class)}
    >
      {props.children}
    </ToastPrimitive.Root>
  ),
  Title: (props: WrapperProps) => (
    <ToastPrimitive.Title {...(props as ToastPrimitive.ToastTitleProps)}>
      {props.children}
    </ToastPrimitive.Title>
  ),
  Description: (props: WrapperProps) => (
    <ToastPrimitive.Description
      {...(props as ToastPrimitive.ToastDescriptionProps)}
      class={cn('ui-subtitle', props.class)}
    >
      {props.children}
    </ToastPrimitive.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <ToastPrimitive.CloseButton
      {...(props as ToastPrimitive.ToastCloseButtonProps)}
      class={cn('ui-button', props.class)}
    >
      {props.children}
    </ToastPrimitive.CloseButton>
  ),
  toaster: ToastPrimitive.toaster,
};
