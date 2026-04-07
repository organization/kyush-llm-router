import { For, createSignal, type Component } from 'solid-js';

import { Button, Checkbox, FormDialog, TextField } from '../ui';

type FieldType = 'text' | 'email' | 'checkbox';

interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  title: string;
  fields: FieldConfig[];
  initialValues: Record<string, unknown>;
}

export const EditModal: Component<EditModalProps> = (props) => {
  const [formData, setFormData] = createSignal(props.initialValues);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    const data = formData();

    for (const field of props.fields) {
      if (field.required && !data[field.name]) {
        setErrorMessage(`${field.label} is required.`);
        return;
      }
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      await props.onSubmit(data);
      props.onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Update failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      class="ui-dialog__content--compact"
      footer={
        <>
          <Button disabled={submitting()} onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={submitting()}
            form="legacy-edit-form"
            type="submit"
            variant="primary"
          >
            Update
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      open={props.isOpen}
      title={props.title}
    >
      <form
        class="ui-form"
        id="legacy-edit-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <For each={props.fields}>
          {(field) =>
            field.type === 'checkbox' ? (
              <Checkbox
                checked={Boolean(formData()[field.name])}
                label={field.label}
                onChange={(checked) =>
                  setFormData({ ...formData(), [field.name]: checked })
                }
              />
            ) : (
              <TextField
                label={field.label}
                onInput={(event) =>
                  setFormData({
                    ...formData(),
                    [field.name]: event.currentTarget.value,
                  })
                }
                placeholder={field.placeholder}
                value={String(formData()[field.name] ?? '')}
              />
            )
          }
        </For>
        {errorMessage() && <p class="ui-field__error">{errorMessage()}</p>}
      </form>
    </FormDialog>
  );
};
