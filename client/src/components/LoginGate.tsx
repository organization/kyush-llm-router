import { createSignal, Show, type Component } from 'solid-js';

import { Alert, Button, Panel, TextField } from '../ui';
import { useAuth } from '../auth';
import { api, ApiError } from '../api/client';

export const LoginGate: Component = () => {
  const auth = useAuth();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await auth.login(username().trim(), password());
      setPassword('');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Admin login failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const authMode = () => auth.session()?.authMode ?? 'both';
  const envEnabled = () => authMode() === 'env' || authMode() === 'both';
  const oidcEnabled = () => authMode() === 'oidc' || authMode() === 'both';

  return (
    <div class="auth-screen">
      <Panel
        class="auth-screen__panel"
        description="Sign in through the internal admin gateway before accessing router operations."
        title="Admin Authentication"
      >
        <div class="ui-stack">
          <Show when={errorMessage()}>
            {(message) => <Alert tone="danger">{message()}</Alert>}
          </Show>

          <Show when={envEnabled()}>
            <form
              class="ui-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <TextField
                label="Username"
                onInput={(event) => setUsername(event.currentTarget.value)}
                value={username()}
              />
              <TextField
                label="Password"
                onInput={(event) => setPassword(event.currentTarget.value)}
                type="password"
                value={password()}
              />
              <Button disabled={submitting()} type="submit" variant="primary">
                {submitting() ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </Show>

          <Show when={oidcEnabled()}>
            <div class="ui-stack ui-stack--tight">
              <p class="ui-subtitle">
                Single sign-on is available through the configured OpenID
                provider.
              </p>
              <Button
                disabled={submitting()}
                onClick={() => api.auth.beginOidc()}
              >
                Continue With OpenID
              </Button>
            </div>
          </Show>
        </div>
      </Panel>
    </div>
  );
};
