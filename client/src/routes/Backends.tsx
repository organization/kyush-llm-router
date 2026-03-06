import { Component, createResource, For, createSignal } from 'solid-js';
import { api } from '../api/client';
import type { Backend } from '../types';
import { Layout } from '../components/Layout';
import { EditModal } from '../components/EditModal';

export const Backends: Component = () => {
  const [backends, { refetch }] = createResource(() => api.backends.getAll());
  const [showModal, setShowModal] = createSignal(false);
  const [formData, setFormData] = createSignal({ name: '', base_url: '', api_key: '' });
  const [editingBackend, setEditingBackend] = createSignal<Backend | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const { name, base_url, api_key } = formData();
    if (!name.trim() || !base_url.trim()) return;

    await api.backends.create({ name: name.trim(), base_url: base_url.trim(), api_key: api_key.trim() || undefined });
    setFormData({ name: '', base_url: '', api_key: '' });
    setShowModal(false);
    refetch();
  };

  const handleDelete = async (backendId: number) => {
    if (!confirm('Are you sure you want to delete this backend?')) return;
    await api.backends.delete(backendId);
    refetch();
  };

  const handleEdit = (backend: Backend) => {
    setEditingBackend(backend);
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (!editingBackend()) return;
    
    if (!confirm('Are you sure you want to update this backend?')) return;

    const updateData: Partial<Backend> = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.base_url) updateData.base_url = data.base_url.trim();
    if (data.api_key !== undefined) updateData.api_key = data.api_key.trim() || undefined;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    await api.backends.update(editingBackend()!.id, updateData);
    setEditingBackend(null);
    refetch();
  };

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' }}>
          <h2 style={{ margin: 0 }}>Backends</h2>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '6px', cursor: 'pointer' }}
          >
            Add Backend
          </button>
        </div>

        {backends.loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', 'border-collapse': 'collapse', background: 'white', 'border-radius': '8px', overflow: 'hidden', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>ID</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Name</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Base URL</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Status</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={backends()}>{(backend) => (
                <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>{backend.id}</td>
                  <td style={{ padding: '12px' }}>{backend.name}</td>
                  <td style={{ padding: '12px', 'font-family': 'monospace', 'font-size': '0.85rem' }}>{backend.base_url}</td>
                  <td style={{ padding: '12px', color: backend.is_active ? '#22c55e' : '#ef4444' }}>
                    {backend.is_active ? 'Active' : 'Inactive'}
                  </td>
                   <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                     <button
                       onClick={() => handleEdit(backend)}
                       style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                     >
                       Edit
                     </button>
                     <button
                       onClick={() => handleDelete(backend.id)}
                       style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                     >
                       Delete
                     </button>
                   </td>
                </tr>
              )}</For>
            </tbody>
          </table>
        )}

        {showModal() && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': 1000 }}>
            <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '500px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>Add New Backend</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Name *</label>
                  <input
                    type="text"
                    value={formData().name}
                    onInput={(e) => setFormData({ ...formData(), name: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px', 'box-sizing': 'border-box' }}
                    required
                  />
                </div>
                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Base URL *</label>
                  <input
                    type="text"
                    value={formData().base_url}
                    onInput={(e) => setFormData({ ...formData(), base_url: e.target.value })}
                    placeholder="http://localhost:8000/v1"
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px', 'box-sizing': 'border-box' }}
                    required
                  />
                </div>
                <div style={{ 'margin-bottom': '20px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>API Key (optional)</label>
                  <input
                    type="text"
                    value={formData().api_key}
                    onInput={(e) => setFormData({ ...formData(), api_key: e.target.value })}
                    placeholder="Backend API key if required"
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px', 'box-sizing': 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingBackend() && (
          <EditModal
            isOpen={!!editingBackend()}
            onClose={() => setEditingBackend(null)}
            onSubmit={handleUpdate}
            title="Edit Backend"
            fields={[
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'base_url', label: 'Base URL', type: 'text', required: true },
              { name: 'api_key', label: 'API Key', type: 'text', required: false },
              { name: 'is_active', label: 'Active', type: 'checkbox', required: false },
            ]}
            initialValues={{
              name: editingBackend()!.name,
              base_url: editingBackend()!.base_url,
              api_key: editingBackend()!.api_key || '',
              is_active: editingBackend()!.is_active,
            }}
          />
        )}
      </div>
    </Layout>
  );
};
