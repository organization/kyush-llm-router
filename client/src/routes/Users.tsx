import { Component, createResource, For, createSignal } from 'solid-js';
import { api } from '../api/client';
import type { User } from '../types';
import { Layout } from '../components/Layout';

export const Users: Component = () => {
  const [users, { refetch }] = createResource(() => api.users.getAll());
  const [showModal, setShowModal] = createSignal(false);
  const [formData, setFormData] = createSignal({ name: '', email: '' });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const { name, email } = formData();
    if (!name.trim()) return;

    await api.users.create({ name: name.trim(), email: email.trim() || undefined });
    setFormData({ name: '', email: '' });
    setShowModal(false);
    refetch();
  };

  const handleRegenerateApiKey = async (userId: number) => {
    await api.users.regenerateApiKey(userId);
    refetch();
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    await api.users.delete(userId);
    refetch();
  };

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' }}>
          <h2 style={{ margin: 0 }}>Users</h2>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '6px', cursor: 'pointer' }}
          >
            Add User
          </button>
        </div>

        {users.loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', 'border-collapse': 'collapse', background: 'white', 'border-radius': '8px', overflow: 'hidden', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>ID</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Name</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Email</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>API Key</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Status</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={users()}>{(user) => (
                <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>{user.id}</td>
                  <td style={{ padding: '12px' }}>{user.name}</td>
                  <td style={{ padding: '12px' }}>{user.email || '-'}</td>
                  <td style={{ padding: '12px', 'font-family': 'monospace', 'font-size': '0.85rem' }}>{user.api_key.substring(0, 15)}...</td>
                  <td style={{ padding: '12px', color: user.is_active ? '#22c55e' : '#ef4444' }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleRegenerateApiKey(user.id)}
                      style={{ padding: '4px 8px', background: '#64748b', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                    >
                      Regenerate Key
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
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
            <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '400px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>Add New User</h3>
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
                <div style={{ 'margin-bottom': '20px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Email</label>
                  <input
                    type="email"
                    value={formData().email}
                    onInput={(e) => setFormData({ ...formData(), email: e.target.value })}
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
      </div>
    </Layout>
  );
};
