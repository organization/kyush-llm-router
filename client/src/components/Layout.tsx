import { Component, JSX, ParentComponent } from 'solid-js';
import { useLocation } from '@solidjs/router';

interface LayoutProps {
  children: JSX.Element;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/users', label: 'Users', icon: '👥' },
  { path: '/backends', label: 'Backends', icon: '🔧' },
  { path: '/permissions', label: 'Permissions', icon: '🔐' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
];

export const Layout: ParentComponent<LayoutProps> = (props) => {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', 'min-height': '100vh', 'font-family': 'system-ui, sans-serif' }}>
      <aside style={{
        width: '250px',
        background: '#1e293b',
        color: 'white',
        padding: '20px',
      }}>
        <h1 style={{ margin: '0 0 30px 0', 'font-size': '1.5rem' }}>LLM Router</h1>
        <nav style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
          {navItems.map(item => (
            <a
              href={item.path}
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '10px',
                padding: '12px 15px',
                background: location.pathname === item.path ? '#3b82f6' : 'transparent',
                color: 'white',
                'text-decoration': 'none',
                'border-radius': '8px',
                transition: 'background 0.2s',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '30px', background: '#f1f5f9' }}>
        {props.children}
      </main>
    </div>
  );
};
