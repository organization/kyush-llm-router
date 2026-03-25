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
      setErrorMessage(error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title={props.title}
      footer={
        <>
          <Button onClick={props.onClose} disabled={submitting()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" form="legacy-edit-form" disabled={submitting()}>
            Update
          </Button>
        </>
      }
      class="ui-dialog__content--compact"
    >
      <form id="legacy-edit-form" class="ui-form" onSubmit={(event) => void handleSubmit(event)}>
        <For each={props.fields}>
          {(field) =>
            field.type === 'checkbox' ? (
              <Checkbox
                label={field.label}
                checked={Boolean(formData()[field.name])}
                onChange={(checked) => setFormData({ ...formData(), [field.name]: checked })}
              />
            ) : (
              <TextField
                label={field.label}
                value={String(formData()[field.name] ?? '')}
                placeholder={field.placeholder}
                onInput={(event) => setFormData({ ...formData(), [field.name]: event.currentTarget.value })}
              />
            )
          }
        </For>
        {errorMessage() && <p class="ui-field__error">{errorMessage()}</p>}
      </form>
    </FormDialog>
  );
};
