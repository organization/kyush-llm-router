import { Component, createResource, For, createSignal } from 'solid-js';
import { api } from '../api/client';
import type { User, Backend, Permission } from '../types';
import { Layout } from '../components/Layout';

export const Permissions: Component = () => {
  const [users, { refetch: refetchUsers }] = createResource(() => api.users.getAll());
  const [backends, { refetch: refetchBackends }] = createResource(() => api.backends.getAll());
  const [permissions, { refetch: refetchPermissions }] = createResource(() => api.permissions.getAll());
  const [showModal, setShowModal] = createSignal(false);
  const [formData, setFormData] = createSignal({ user_id: '', backend_id: '' });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const { user_id, backend_id } = formData();
    if (!user_id || !backend_id) return;

    await api.permissions.create({ user_id: Number(user_id), backend_id: Number(backend_id) });
    setFormData({ user_id: '', backend_id: '' });
    setShowModal(false);
    refetchPermissions();
  };

  const handleDelete = async (userId: number, backendId: number) => {
    if (!confirm('Are you sure you want to revoke this permission?')) return;
    await api.permissions.delete(userId, backendId);
    refetchPermissions();
  };

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' }}>
          <h2 style={{ margin: 0 }}>Permissions</h2>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '6px', cursor: 'pointer' }}
          >
            Add Permission
          </button>
        </div>

        {permissions.loading || users.loading || backends.loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', 'border-collapse': 'collapse', background: 'white', 'border-radius': '8px', overflow: 'hidden', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>User</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Backend</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Created At</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={permissions()}>{(permission) => {
                const user = users()?.find(u => u.id === permission.user_id);
                const backend = backends()?.find(b => b.id === permission.backend_id);

                return (
                  <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>{user?.name || `User #${permission.user_id}`}</td>
                    <td style={{ padding: '12px' }}>{backend?.name || `Backend #${permission.backend_id}`}</td>
                    <td style={{ padding: '12px' }}>{new Date(permission.created_at).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => handleDelete(permission.user_id, permission.backend_id)}
                        style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              }}</For>
            </tbody>
          </table>
        )}

        {showModal() && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': 1000 }}>
            <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '400px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>Add Permission</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>User *</label>
                  <select
                    value={formData().user_id}
                    onChange={(e) => setFormData({ ...formData(), user_id: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                    required
                  >
                    <option value="">Select a user</option>
                    <For each={users()}>{(user) => (
                      <option value={user.id}>{user.name}</option>
                    )}</For>
                  </select>
                </div>
                <div style={{ 'margin-bottom': '20px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Backend *</label>
                  <select
                    value={formData().backend_id}
                    onChange={(e) => setFormData({ ...formData(), backend_id: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                    required
                  >
                    <option value="">Select a backend</option>
                    <For each={backends()}>{(backend) => (
                      <option value={backend.id}>{backend.name}</option>
                    )}</For>
                  </select>
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
                    Grant
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
