import type { JSX, ParentComponent } from 'solid-js';
import { AppShell } from '../ui';

interface LayoutProps {
  children: JSX.Element;
}

export const Layout: ParentComponent<LayoutProps> = (props) => <AppShell>{props.children}</AppShell>;
