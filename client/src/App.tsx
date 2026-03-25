import { Router, Route } from '@solidjs/router';
import { Show } from 'solid-js';
import { Dashboard } from './routes/Dashboard';
import { Users } from './routes/Users';
import { Backends } from './routes/Backends';
import { Permissions } from './routes/Permissions';
import { Analytics } from './routes/Analytics';
import { DetailLogs } from './routes/DetailLogs';
import { Scripts } from './routes/Scripts';
import { AuthProvider, useAuth } from './auth';
import { LoginGate } from './components/LoginGate';
import { Panel } from './ui';

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
        <Router base="/dashboard">
          <Route path="/" component={Dashboard} />
          <Route path="/users" component={Users} />
          <Route path="/backends" component={Backends} />
          <Route path="/permissions" component={Permissions} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/detail-logs" component={DetailLogs} />
          <Route path="/scripts" component={Scripts} />
        </Router>
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
