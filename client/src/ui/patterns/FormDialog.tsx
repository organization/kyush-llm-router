import type { JSX, ParentProps } from 'solid-js';
import { Dialog } from '../index';
import { cn } from '../lib/cn';

interface FormDialogProps extends ParentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer: JSX.Element;
  class?: string;
}

export function FormDialog(props: FormDialogProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content class={cn('ui-dialog__content', props.class)}>
          <div class="ui-dialog__header">
            <div>
              <Dialog.Title>{props.title}</Dialog.Title>
              {props.description && <Dialog.Description>{props.description}</Dialog.Description>}
            </div>
          </div>
          <div class="ui-dialog__body">{props.children}</div>
          <div class="ui-dialog__footer">{props.footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
