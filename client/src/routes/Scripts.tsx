import { Component, createResource, For, createSignal } from 'solid-js';
import { api } from '../api/client';
import type { UserScript, ScriptType } from '../types';
import { Layout } from '../components/Layout';
import { ScriptEditor } from '../components/ScriptEditor';

export const Scripts: Component = () => {
  const [scripts, { refetch: refetchScripts }] = createResource(() => api.scripts.getAll());
  const [users, { refetch: refetchUsers }] = createResource(() => api.users.getAll());
  const [backends, { refetch: refetchBackends }] = createResource(() => api.backends.getAll());
  const [showModal, setShowModal] = createSignal(false);
  const [editingScript, setEditingScript] = createSignal<UserScript | null>(null);
  const [formData, setFormData] = createSignal({
    name: '',
    script_type: 'per-user-backend' as ScriptType,
    target_user_id: '',
    target_backend_id: '',
    script_code: '',
    is_active: true,
  });
  const [showTestModal, setShowTestModal] = createSignal(false);
  const [testScript, setTestScript] = createSignal<UserScript | null>(null);
  const [testResult, setTestResult] = createSignal<{ success: boolean; error?: string; executionTime?: number } | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      script_type: 'per-user-backend',
      target_user_id: '',
      target_backend_id: '',
      script_code: '',
      is_active: true,
    });
    setEditingScript(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const data = formData();
    
    let targetUserId: number | null = null;
    let targetBackendId: number | null = null;

    if (data.script_type === 'per-user-backend') {
      if (!data.target_user_id || !data.target_backend_id) {
        alert('Please select both user and backend');
        return;
      }
      targetUserId = Number(data.target_user_id);
      targetBackendId = Number(data.target_backend_id);
    } else if (data.script_type === 'per-backend') {
      if (!data.target_backend_id) {
        alert('Please select backend');
        return;
      }
      targetBackendId = Number(data.target_backend_id);
    } else if (data.script_type === 'per-user') {
      if (!data.target_user_id) {
        alert('Please select user');
        return;
      }
      targetUserId = Number(data.target_user_id);
    }

    if (editingScript()) {
      await api.scripts.update(editingScript()!.id, {
        name: data.name,
        script_type: data.script_type,
        target_user_id: targetUserId,
        target_backend_id: targetBackendId,
        script_code: data.script_code,
        is_active: data.is_active,
      });
    } else {
      await api.scripts.create({
        name: data.name,
        script_type: data.script_type,
        target_user_id: targetUserId,
        target_backend_id: targetBackendId,
        script_code: data.script_code,
        is_active: data.is_active,
      });
    }

    resetForm();
    setShowModal(false);
    refetchScripts();
    refetchUsers();
    refetchBackends();
  };

  const handleEdit = (script: UserScript) => {
    setEditingScript(script);
    setFormData({
      name: script.name,
      script_type: script.script_type,
      target_user_id: script.target_user_id?.toString() || '',
      target_backend_id: script.target_backend_id?.toString() || '',
      script_code: script.script_code,
      is_active: script.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this script?')) return;
    await api.scripts.delete(id);
    refetchScripts();
  };

  const handleToggleActive = async (script: UserScript) => {
    if (script.is_active) {
      await api.scripts.deactivate(script.id);
    } else {
      await api.scripts.activate(script.id);
    }
    refetchScripts();
  };

  const handleTest = async (script: UserScript) => {
    setTestScript(script);
    setTestResult(null);
    setShowTestModal(true);
  };

  const runTest = async () => {
    const script = testScript();
    if (!script) return;

    try {
      const result = await api.scripts.test(script.id, {
        user: users()?.[0] || undefined,
        backend: backends()?.[0] || undefined,
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: { 'Content-Type': 'application/json' },
          body: { model: 'test', messages: [{ role: 'user', content: 'test' }] },
          isStream: false,
        },
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const getScriptTypeLabel = (type: ScriptType) => {
    switch (type) {
      case 'per-user-backend': return 'Per User + Backend';
      case 'per-backend': return 'Per Backend';
      case 'per-user': return 'Per User';
      default: return type;
    }
  };

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' }}>
          <h2 style={{ margin: 0 }}>User Scripts</h2>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '6px', cursor: 'pointer' }}
          >
            Create Script
          </button>
        </div>

        <p style={{ color: '#64748b', 'margin-bottom': '20px' }}>
          Create custom middleware scripts that run before requests are sent to backends (onRequest) 
          and after responses are received (onResponse).
        </p>

        {scripts.loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', 'border-collapse': 'collapse', background: 'white', 'border-radius': '8px', overflow: 'hidden', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Name</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Type</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Target</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Status</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Created At</th>
                <th style={{ 'text-align': 'left', padding: '12px', 'border-bottom': '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={scripts()}>{(script) => {
                const user = users()?.find(u => u.id === script.target_user_id);
                const backend = backends()?.find(b => b.id === script.target_backend_id);

                let targetText = '-';
                if (script.script_type === 'per-user-backend') {
                  targetText = `${user?.name || 'N/A'} + ${backend?.name || 'N/A'}`;
                } else if (script.script_type === 'per-backend') {
                  targetText = backend?.name || 'N/A';
                } else if (script.script_type === 'per-user') {
                  targetText = user?.name || 'N/A';
                }

                return (
                  <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px', 'font-weight': '500' }}>{script.name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: script.script_type === 'per-user-backend' ? '#dbeafe' : script.script_type === 'per-backend' ? '#fef3c7' : '#d1fae5',
                        color: script.script_type === 'per-user-backend' ? '#1e40af' : script.script_type === 'per-backend' ? '#92400e' : '#065f46',
                        'border-radius': '4px',
                        'font-size': '0.85rem'
                      }}>
                        {getScriptTypeLabel(script.script_type)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{targetText}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: script.is_active ? '#dcfce7' : '#fee2e2',
                        color: script.is_active ? '#166534' : '#991b1b',
                        'border-radius': '4px',
                        'font-size': '0.85rem'
                      }}>
                        {script.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{new Date(script.created_at).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleTest(script)}
                          style={{ padding: '4px 8px', background: '#8b5cf6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                        >
                          Test
                        </button>
                        <button
                          onClick={() => handleEdit(script)}
                          style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(script)}
                          style={{ padding: '4px 8px', background: script.is_active ? '#f59e0b' : '#10b981', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                        >
                          {script.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(script.id)}
                          style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '0.8rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }}</For>
            </tbody>
          </table>
        )}

        {showModal() && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': 1000 }}>
            <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '800px', 'max-height': '90vh', overflow: 'auto' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>{editingScript() ? 'Edit Script' : 'Create Script'}</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Name *</label>
                  <input
                    type="text"
                    value={formData().name}
                    onChange={(e) => setFormData({ ...formData(), name: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                    required
                  />
                </div>

                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Script Type *</label>
                  <select
                    value={formData().script_type}
                    onChange={(e) => setFormData({ ...formData(), script_type: e.target.value as ScriptType, target_user_id: '', target_backend_id: '' })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                    required
                  >
                    <option value="per-user-backend">Per User + Backend</option>
                    <option value="per-backend">Per Backend</option>
                    <option value="per-user">Per User</option>
                  </select>
                </div>

                {formData().script_type === 'per-user-backend' && (
                  <>
                    <div style={{ 'margin-bottom': '15px' }}>
                      <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Target User *</label>
                      <select
                        value={formData().target_user_id}
                        onChange={(e) => setFormData({ ...formData(), target_user_id: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                        required
                      >
                        <option value="">Select a user</option>
                        <For each={users()}>{(user) => (
                          <option value={user.id}>{user.name}</option>
                        )}</For>
                      </select>
                    </div>
                    <div style={{ 'margin-bottom': '15px' }}>
                      <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Target Backend *</label>
                      <select
                        value={formData().target_backend_id}
                        onChange={(e) => setFormData({ ...formData(), target_backend_id: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                        required
                      >
                        <option value="">Select a backend</option>
                        <For each={backends()}>{(backend) => (
                          <option value={backend.id}>{backend.name}</option>
                        )}</For>
                      </select>
                    </div>
                  </>
                )}

                {formData().script_type === 'per-backend' && (
                  <div style={{ 'margin-bottom': '15px' }}>
                    <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Target Backend *</label>
                    <select
                      value={formData().target_backend_id}
                      onChange={(e) => setFormData({ ...formData(), target_backend_id: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                      required
                    >
                      <option value="">Select a backend</option>
                      <For each={backends()}>{(backend) => (
                        <option value={backend.id}>{backend.name}</option>
                      )}</For>
                    </select>
                  </div>
                )}

                {formData().script_type === 'per-user' && (
                  <div style={{ 'margin-bottom': '15px' }}>
                    <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Target User *</label>
                    <select
                      value={formData().target_user_id}
                      onChange={(e) => setFormData({ ...formData(), target_user_id: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', 'border-radius': '4px' }}
                      required
                    >
                      <option value="">Select a user</option>
                      <For each={users()}>{(user) => (
                        <option value={user.id}>{user.name}</option>
                      )}</For>
                    </select>
                  </div>
                )}

                <div style={{ 'margin-bottom': '15px' }}>
                  <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold' }}>Script Code *</label>
                  <ScriptEditor
                    value={formData().script_code}
                    onChange={(value) => setFormData({ ...formData(), script_code: value })}
                  />
                </div>

                <div style={{ 'margin-bottom': '20px' }}>
                  <label style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={formData().is_active}
                      onChange={(e) => setFormData({ ...formData(), is_active: e.target.checked })}
                    />
                    <span style={{ 'font-weight': 'bold' }}>Active</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                  >
                    {editingScript() ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showTestModal() && testScript() && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': 1000 }}>
            <div style={{ background: 'white', padding: '30px', 'border-radius': '8px', width: '600px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>Test Script: {testScript()?.name}</h3>
              
              <div style={{ 'margin-bottom': '20px', padding: '15px', background: '#f8fafc', 'border-radius': '4px' }}>
                <p style={{ margin: '0 0 10px 0', 'font-weight': 'bold' }}>Test Context:</p>
                <p style={{ margin: 0, 'font-size': '0.9rem', color: '#64748b' }}>
                  User: {users()?.[0]?.name || 'N/A'} | Backend: {backends()?.[0]?.name || 'N/A'}
                </p>
              </div>

              {testResult() && (
                <div style={{
                  'margin-bottom': '20px',
                  padding: '15px',
                  background: testResult()!.success ? '#dcfce7' : '#fee2e2',
                  'border-radius': '4px',
                  color: testResult()!.success ? '#166534' : '#991b1b'
                }}>
                  <p style={{ margin: '0 0 5px 0', 'font-weight': 'bold' }}>
                    {testResult()!.success ? '✓ Success' : '✗ Failed'}
                  </p>
                  {testResult()!.error && <p style={{ margin: 0, 'font-size': '0.9rem' }}>{testResult()!.error}</p>}
                  {testResult()!.executionTime && (
                    <p style={{ margin: '5px 0 0 0', 'font-size': '0.85rem' }}>
                      Execution time: {testResult()!.executionTime}ms
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
                <button
                  onClick={() => { setShowTestModal(false); setTestResult(null); }}
                  style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  onClick={runTest}
                  style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}
                >
                  Run Test
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
