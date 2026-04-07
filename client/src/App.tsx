import { Router, Route } from '@solidjs/router';
import { lazy, Show, Suspense } from 'solid-js';

import { AuthProvider, useAuth } from './auth';
import { LoginGate } from './components/LoginGate';
import { Panel } from './ui';

const Dashboard = lazy(() =>
  import('./routes/Dashboard').then((module) => ({
    default: module.Dashboard,
  })),
);
const Users = lazy(() =>
  import('./routes/Users').then((module) => ({ default: module.Users })),
);
const Backends = lazy(() =>
  import('./routes/Backends').then((module) => ({ default: module.Backends })),
);
const Analytics = lazy(() =>
  import('./routes/Analytics').then((module) => ({
    default: module.Analytics,
  })),
);
const DetailLogs = lazy(() =>
  import('./routes/DetailLogs').then((module) => ({
    default: module.DetailLogs,
  })),
);
const Models = lazy(() =>
  import('./routes/Models').then((module) => ({ default: module.Models })),
);
const Scripts = lazy(() =>
  import('./routes/Scripts').then((module) => ({ default: module.Scripts })),
);

function RouteLoadingFallback() {
  return (
    <div class="auth-screen">
      <Panel
        class="auth-screen__panel"
        description="Preparing the selected dashboard view."
        title="Loading Admin Page"
      />
    </div>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();

  return (
    <Show
      fallback={
        <div class="auth-screen">
          <Panel
            class="auth-screen__panel"
            description="Restoring the current administrator session."
            title="Loading Admin Session"
          />
        </div>
      }
      when={!auth.loading()}
    >
      <Show fallback={<LoginGate />} when={auth.session()?.authenticated}>
        <Suspense fallback={<RouteLoadingFallback />}>
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
