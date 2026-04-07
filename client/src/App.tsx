import { Route, Router } from '@solidjs/router';
import { lazy, Show, Suspense } from 'solid-js';

import { AuthProvider, useAuth } from './auth';
import LoginGate from './components/login-gate';
import { Panel } from './ui';

const Dashboard = lazy(() => import('./routes/Dashboard'));
const Users = lazy(() => import('./routes/Users'));
const Backends = lazy(() => import('./routes/Backends'));
const Analytics = lazy(() => import('./routes/Analytics'));
const DetailLogs = lazy(() => import('./routes/DetailLogs'));
const Models = lazy(() => import('./routes/Models'));
const Scripts = lazy(() => import('./routes/Scripts'));

function FullScreenPanel(props: { title: string; description: string }) {
  return (
    <div class="auth-screen">
      <Panel
        class="auth-screen__panel"
        description={props.description}
        title={props.title}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();

  return (
    <Show
      fallback={
        <FullScreenPanel
          description="Restoring the current administrator session."
          title="Loading Admin Session"
        />
      }
      when={!auth.loading()}
    >
      <Show fallback={<LoginGate />} when={auth.session()?.authenticated}>
        <Suspense
          fallback={
            <FullScreenPanel
              description="Preparing the selected dashboard view."
              title="Loading Admin Page"
            />
          }
        >
          <Router base="/dashboard">
            <Route component={Dashboard} path="/" />
            <Route component={Users} path="/users" />
            <Route component={Backends} path="/backends" />
            <Route component={Analytics} path="/analytics" />
            <Route component={Models} path="/models" />
            <Route component={DetailLogs} path="/detail-logs" />
            <Route component={Scripts} path="/scripts" />
          </Router>
        </Suspense>
      </Show>
    </Show>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
