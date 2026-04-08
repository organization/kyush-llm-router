import { Button, Dialog } from '../index';

import type { JSX } from 'solid-js';

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
    <Dialog.Root onOpenChange={props.onOpenChange} open={props.open}>
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
            <Button
              disabled={props.busy}
              onClick={() => props.onOpenChange(false)}
            >
              {props.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              disabled={props.busy}
              onClick={() => void props.onConfirm()}
              variant={props.tone === 'danger' ? 'danger' : 'primary'}
            >
              {props.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
