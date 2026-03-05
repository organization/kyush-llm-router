import { Component, createResource, For } from 'solid-js';
import { api } from '../api/client';
import type { RequestLog, UsageStats, BackendMetrics } from '../types';
import { Layout } from '../components/Layout';

export const Analytics: Component = () => {
  const [requests] = createResource(() => api.analytics.getRequests(50));
  const [usage] = createResource(() => api.analytics.getUsage(undefined, undefined, 7));
  const [metrics] = createResource(() => api.analytics.getMetrics(undefined, 7));

  return (
    <Layout>
      <div style={{ padding: '30px' }}>
        <h2 style={{ margin: '0 0 20px 0' }}>Analytics</h2>

        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', 'margin-bottom': '30px' }}>
          <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', 'font-size': '0.9rem', color: '#64748b' }}>Recent Requests</h3>
            <div style={{ 'max-height': '300px', overflow: 'auto' }}>
              {requests.loading ? (
                <p>Loading...</p>
              ) : (
                <table style={{ width: '100%', 'font-size': '0.85rem' }}>
                  <thead>
                    <tr style={{ 'border-bottom': '2px solid #e2e8f0' }}>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>User</th>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>Tokens</th>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={requests()}>{(req) => (
                      <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px' }}>{req.user_id}</td>
                        <td style={{ padding: '8px' }}>{req.total_tokens || 0}</td>
                        <td style={{ padding: '8px', color: req.status_code >= 400 ? '#ef4444' : '#22c55e' }}>{req.status_code}</td>
                      </tr>
                    )}</For>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', 'font-size': '0.9rem', color: '#64748b' }}>Usage Stats (7 days)</h3>
            <div style={{ 'max-height': '300px', overflow: 'auto' }}>
              {usage.loading ? (
                <p>Loading...</p>
              ) : (
                <table style={{ width: '100%', 'font-size': '0.85rem' }}>
                  <thead>
                    <tr style={{ 'border-bottom': '2px solid #e2e8f0' }}>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>Date</th>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>Requests</th>
                      <th style={{ 'text-align': 'left', padding: '8px' }}>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={usage()}>{(stat) => (
                      <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px' }}>{stat.date}</td>
                        <td style={{ padding: '8px' }}>{stat.total_requests}</td>
                        <td style={{ padding: '8px' }}>{stat.total_tokens}</td>
                      </tr>
                    )}</For>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px 0', 'font-size': '0.9rem', color: '#64748b' }}>Backend Metrics (7 days)</h3>
          <div style={{ 'max-height': '300px', overflow: 'auto' }}>
            {metrics.loading ? (
              <p>Loading...</p>
            ) : (
              <table style={{ width: '100%', 'font-size': '0.85rem' }}>
                <thead>
                  <tr style={{ 'border-bottom': '2px solid #e2e8f0' }}>
                    <th style={{ 'text-align': 'left', padding: '8px' }}>Date</th>
                    <th style={{ 'text-align': 'left', padding: '8px' }}>Backend</th>
                    <th style={{ 'text-align': 'left', padding: '8px' }}>Requests</th>
                    <th style={{ 'text-align': 'left', padding: '8px' }}>Avg Response (ms)</th>
                    <th style={{ 'text-align': 'left', padding: '8px' }}>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={metrics()}>{(metric) => (
                    <tr style={{ 'border-bottom': '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>{metric.date}</td>
                      <td style={{ padding: '8px' }}>{metric.backend_id}</td>
                      <td style={{ padding: '8px' }}>{metric.total_requests}</td>
                      <td style={{ padding: '8px' }}>{metric.avg_response_time_ms?.toFixed(1) || 0}</td>
                      <td style={{ padding: '8px' }}>{(metric.success_rate * 100).toFixed(1)}%</td>
                    </tr>
                  )}</For>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
