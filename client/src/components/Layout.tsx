import { AppShell } from '../ui';

import type { JSX, ParentComponent } from 'solid-js';

interface LayoutProps {
  children: JSX.Element;
}

export const Layout: ParentComponent<LayoutProps> = (props) => (
  <AppShell>{props.children}</AppShell>
);
