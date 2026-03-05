import { Component, createResource, For } from 'solid-js';
import { api } from '../api/client';
import type { User, Backend, RequestLog } from '../types';
import { Layout } from '../components/Layout';

export const Dashboard: Component = () => {
  const [data, { refetch }] = createResource(async () => ({
    users: await api.users.getAll(),
    backends: await api.backends.getAll(),
    recentRequests: await api.analytics.getRequests(10),
  }));

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <h2 style={{ margin: '0 0 20px 0' }}>Dashboard</h2>

        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', 'margin-bottom': '30px' }}>
          <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', 'font-size': '0.9rem', color: '#64748b' }}>Total Users</h3>
            <p style={{ margin: 0, 'font-size': '2rem', 'font-weight': 'bold' }}>{data()?.users.length || 0}</p>
          </div>
          <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', 'font-size': '0.9rem', color: '#64748b' }}>Active Backends</h3>
            <p style={{ margin: 0, 'font-size': '2rem', 'font-weight': 'bold' }}>{data()?.backends.filter(b => b.is_active).length || 0}</p>
          </div>
          <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', 'font-size': '0.9rem', color: '#64748b' }}>Recent Requests</h3>
            <p style={{ margin: 0, 'font-size': '2rem', 'font-weight': 'bold' }}>{data()?.recentRequests.length || 0}</p>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '15px' }}>
            <h3 style={{ margin: 0 }}>Recent Requests</h3>
            <button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', 'border-radius': '6px', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
          {data()?.recentRequests.length === 0 ? (
            <p style={{ color: '#64748b' }}>No requests yet</p>
          ) : (
            <table style={{ width: '100%', 'border-collapse': 'collapse' }}>
              <thead>
                <tr style={{ 'border-bottom': '2px solid #e2e8f0' }}>
                  <th style={{ 'text-align': 'left', padding: '10px', color: '#64748b' }}>User ID</th>
                  <th style={{ 'text-align': 'left', padding: '10px', color: '#64748b' }}>Backend</th>
                  <th style={{ 'text-align': 'left', padding: '10px', color: '#64748b' }}>Model</th>
                  <th style={{ 'text-align': 'left', padding: '10px', color: '#64748b' }}>Status</th>
                  <th style={{ 'text-align': 'left', padding: '10px', color: '#64748b' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                <For each={data()?.recentRequests}>{(request) => (
                  <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px' }}>{request.user_id}</td>
                    <td style={{ padding: '10px' }}>{request.backend_id}</td>
                    <td style={{ padding: '10px' }}>{request.request_model || '-'}</td>
                    <td style={{ padding: '10px', color: request.status_code >= 400 ? '#ef4444' : '#22c55e' }}>{request.status_code}</td>
                    <td style={{ padding: '10px' }}>{new Date(request.created_at).toLocaleString()}</td>
                  </tr>
                )}</For>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};
