import { Router, Route } from '@solidjs/router';
import { Dashboard } from './routes/Dashboard';
import { Users } from './routes/Users';
import { Backends } from './routes/Backends';
import { Permissions } from './routes/Permissions';
import { Analytics } from './routes/Analytics';
import { Scripts } from './routes/Scripts';

export default function App() {
  return (
    <Router>
      <Route path="/" component={Dashboard} />
      <Route path="/users" component={Users} />
      <Route path="/backends" component={Backends} />
      <Route path="/permissions" component={Permissions} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/scripts" component={Scripts} />
    </Router>
  );
}
