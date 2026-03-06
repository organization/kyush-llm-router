import { Component, For, createSignal } from 'solid-js';

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
  onSubmit: (data: Record<string, any>) => Promise<void>;
  title: string;
  fields: FieldConfig[];
  initialValues: Record<string, any>;
}

export const EditModal: Component<EditModalProps> = (props) => {
  const [formData, setFormData] = createSignal(props.initialValues);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const data = formData();

    for (const field of props.fields) {
      if (field.required && !data[field.name]) {
        alert(`${field.label} is required`);
        return;
      }
    }

    try {
      await props.onSubmit(data);
      props.onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      alert(message);
    }
  };

  if (!props.isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': 1000 }}>
      <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '400px' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>{props.title}</h3>
        <form onSubmit={handleSubmit}>
          <For each={props.fields}>{(field) => (
            <div style={{ 'margin-bottom': field.type === 'checkbox' ? '20px' : '15px' }}>
              <label style={{ display: field.type === 'checkbox' ? 'flex' : 'block', 'align-items': field.type === 'checkbox' ? 'center' : 'flex-start', gap: '8px', 'margin-bottom': field.type === 'checkbox' ? 0 : '5px', 'font-weight': 'bold' }}>
                {field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={formData()[field.name] || false}
                    onChange={(e) => setFormData({ ...formData(), [field.name]: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                ) : null}
                {field.label}
                {field.required && <span style={{ color: 'red' }}>*</span>}
              </label>
              {field.type !== 'checkbox' && (
                <input
                  type={field.type}
                  value={formData()[field.name] || ''}
                  onInput={(e) => setFormData({ ...formData(), [field.name]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px', 'box-sizing': 'border-box' }}
                  required={field.required}
                />
              )}
            </div>
          )}</For>
          <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
            <button
              type="button"
              onClick={props.onClose}
              style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
