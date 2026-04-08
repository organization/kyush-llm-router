import { A, useLocation } from '@solidjs/router';
import ChartColumn from 'lucide-solid/icons/chart-column';
import FileCode from 'lucide-solid/icons/file-code';
import LayoutDashboard from 'lucide-solid/icons/layout-dashboard';
import LogOut from 'lucide-solid/icons/log-out';
import Logs from 'lucide-solid/icons/logs';
import Network from 'lucide-solid/icons/network';
import Moon from 'lucide-solid/icons/moon';
import Server from 'lucide-solid/icons/server';
import Sun from 'lucide-solid/icons/sun';
import Users from 'lucide-solid/icons/users';
import {
  For,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
  type ParentComponent,
} from 'solid-js';

import SnakegroundBg from '../../components/SnakegroundBg';
import { useAuth } from '../../auth';
import { IconButton } from '../primitives/IconButton';
import { cn } from '../lib/cn';

import type { ThemeMode } from '../tokens';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/backends', label: 'Backends', icon: Server },
  { path: '/models', label: 'Models', icon: Network },
  { path: '/scripts', label: 'Scripts', icon: FileCode },
  { path: '/detail-logs', label: 'Detail Logs', icon: Logs },
  { path: '/analytics', label: 'Analytics', icon: ChartColumn },
];

interface AppShellProps {
  children: JSX.Element;
}

const THEME_STORAGE_KEY = 'kyush-theme';

export const AppShell: ParentComponent<AppShellProps> = (props) => {
  const location = useLocation();
  const auth = useAuth();
  const [themeMode, setThemeMode] = createSignal<ThemeMode>('system');
  const [systemPrefersDark, setSystemPrefersDark] = createSignal(false);

  const resolvedTheme = createMemo<'light' | 'dark'>(() => {
    const mode = themeMode();

    if (mode === 'system') {
      return systemPrefersDark() ? 'dark' : 'light';
    }

    return mode;
  });

  onMount(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      const nextTheme =
        mode === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : mode;
      root.dataset.theme = nextTheme;
    };

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialMode: ThemeMode =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : 'system';

    const syncSystemTheme = () => {
      setSystemPrefersDark(mediaQuery.matches);
      if (themeMode() === 'system') {
        applyTheme('system');
      }
    };

    setThemeMode(initialMode);
    setSystemPrefersDark(mediaQuery.matches);
    applyTheme(initialMode);

    mediaQuery.addEventListener('change', syncSystemTheme);

    onCleanup(() => {
      mediaQuery.removeEventListener('change', syncSystemTheme);
    });
  });

  const toggleTheme = () => {
    const nextMode: ThemeMode = resolvedTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    setThemeMode(nextMode);
  };

  return (
    <div class="app-shell">
      <SnakegroundBg />

      <aside class="nav-rail">
        <div class="nav-rail__brand">
          <div class="nav-rail__brand-mark">KR</div>
          <div>
            <p class="nav-rail__eyebrow">Kyush Router</p>
            <h1 class="nav-rail__title">Admin Console</h1>
          </div>
        </div>

        <nav aria-label="Primary navigation" class="nav-rail__nav">
          <For each={navItems}>
            {(item) => (
              <A
                class={cn(
                  'nav-rail__link',
                  location.pathname === item.path && 'nav-rail__link--active',
                )}
                href={item.path}
              >
                <span aria-hidden="true" class="nav-rail__link-mark">
                  <item.icon />
                </span>
                <span>{item.label}</span>
              </A>
            )}
          </For>
        </nav>

        <div class="nav-rail__footer">
          <div class="nav-rail__session">
            <p class="nav-rail__session-name">
              {auth.session()?.principal?.displayName ?? 'Admin'}
            </p>
            <p class="nav-rail__session-meta">
              {auth.session()?.principal?.email ??
                auth.session()?.principal?.subject ??
                ''}
            </p>
          </div>
          <IconButton
            class="nav-rail__theme-toggle"
            icon={resolvedTheme() === 'dark' ? <Sun /> : <Moon />}
            label={resolvedTheme() === 'dark' ? 'Light Mode' : 'Dark Mode'}
            onClick={toggleTheme}
          />
          <IconButton
            class="nav-rail__theme-toggle"
            icon={<LogOut />}
            label="Sign Out"
            onClick={() => void auth.logout()}
          />
        </div>
      </aside>

      <main class="workspace">{props.children}</main>
    </div>
  );
};
