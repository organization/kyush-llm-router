import type { JSX } from 'solid-js';
import { Button, Dialog } from '../index';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  details?: JSX.Element;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content class="ui-dialog__content ui-dialog__content--compact">
          <div class="ui-dialog__header">
            <div>
              <Dialog.Title>{props.title}</Dialog.Title>
              <Dialog.Description>{props.description}</Dialog.Description>
            </div>
          </div>
          {props.details && <div class="ui-dialog__body">{props.details}</div>}
          <div class="ui-dialog__footer">
            <Button onClick={() => props.onOpenChange(false)} disabled={props.busy}>
              {props.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={props.tone === 'danger' ? 'danger' : 'primary'} onClick={() => void props.onConfirm()} disabled={props.busy}>
              {props.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
