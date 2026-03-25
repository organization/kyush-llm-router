import * as KToast from '@kobalte/core/toast';
import type { ParentProps } from 'solid-js';
import { cn } from '../lib/cn';

type WrapperProps = ParentProps<{ class?: string; [key: string]: unknown }>;

export const Toast = {
  Region: (props: WrapperProps) => (
    <KToast.Region {...(props as KToast.ToastRegionProps)} class={cn('ui-toast-region', props.class)}>
      {props.children}
    </KToast.Region>
  ),
  List: (props: WrapperProps) => (
    <KToast.List {...(props as KToast.ToastListProps)} class={cn('ui-toast-list', props.class)}>
      {props.children}
    </KToast.List>
  ),
  Root: (props: WrapperProps) => (
    <KToast.Root {...(props as unknown as KToast.ToastRootProps)} class={cn('ui-toast', props.class)}>
      {props.children}
    </KToast.Root>
  ),
  Title: (props: WrapperProps) => <KToast.Title {...(props as KToast.ToastTitleProps)}>{props.children}</KToast.Title>,
  Description: (props: WrapperProps) => (
    <KToast.Description {...(props as KToast.ToastDescriptionProps)} class={cn('ui-subtitle', props.class)}>
      {props.children}
    </KToast.Description>
  ),
  CloseButton: (props: WrapperProps) => (
    <KToast.CloseButton {...(props as KToast.ToastCloseButtonProps)} class={cn('ui-button', props.class)}>
      {props.children}
    </KToast.CloseButton>
  ),
  toaster: KToast.toaster,
};
