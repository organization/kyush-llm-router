import { Router, Route } from '@solidjs/router';
import { lazy, Show, Suspense } from 'solid-js';
import { AuthProvider, useAuth } from './auth';
import { LoginGate } from './components/LoginGate';
import { Panel } from './ui';

const Dashboard = lazy(() => import('./routes/Dashboard').then((module) => ({ default: module.Dashboard })));
const Users = lazy(() => import('./routes/Users').then((module) => ({ default: module.Users })));
const Backends = lazy(() => import('./routes/Backends').then((module) => ({ default: module.Backends })));
const Permissions = lazy(() => import('./routes/Permissions').then((module) => ({ default: module.Permissions })));
const Analytics = lazy(() => import('./routes/Analytics').then((module) => ({ default: module.Analytics })));
const DetailLogs = lazy(() => import('./routes/DetailLogs').then((module) => ({ default: module.DetailLogs })));
const Scripts = lazy(() => import('./routes/Scripts').then((module) => ({ default: module.Scripts })));

function RouteLoadingFallback() {
  return (
    <div class="auth-screen">
      <Panel class="auth-screen__panel" title="Loading Admin Page" description="Preparing the selected dashboard view." />
    </div>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();

  return (
    <Show
      when={!auth.loading()}
      fallback={
        <div class="auth-screen">
          <Panel class="auth-screen__panel" title="Loading Admin Session" description="Restoring the current administrator session." />
        </div>
      }
    >
      <Show when={auth.session()?.authenticated} fallback={<LoginGate />}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Router base="/dashboard">
            <Route path="/" component={Dashboard} />
            <Route path="/users" component={Users} />
            <Route path="/backends" component={Backends} />
            <Route path="/permissions" component={Permissions} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/detail-logs" component={DetailLogs} />
            <Route path="/scripts" component={Scripts} />
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
