import { createSignal } from 'solid-js';

import {
  Alert,
  Button,
  Checkbox,
  CommandBar,
  CommandBarGroup,
  CommandBarHint,
  Dialog,
  DropdownMenu,
  FieldRow,
  Popover,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  TextField,
  Tooltip,
} from '../index';

export default {
  title: 'UI/Primitives',
  tags: ['autodocs'],
};

export const Default = {
  render: () => {
    const [dialogOpen, setDialogOpen] = createSignal(false);
    const [selected, setSelected] = createSignal('analytics');

    return (
      <div class="ui-workbench ui-stack">
        <div>
          <h1 class="ui-title">Kobalte Wrapper Workbench</h1>
          <p class="ui-subtitle">
            Compact primitives for the router admin console.
          </p>
        </div>

        <CommandBar>
          <CommandBarGroup>
            <Button variant="primary">Create Backend</Button>
            <Button>Refresh</Button>
            <StatusBadge tone="success">Active</StatusBadge>
          </CommandBarGroup>
          <CommandBarGroup>
            <CommandBarHint>
              <span class="ui-kbd">Ctrl</span> + <span class="ui-kbd">N</span>
            </CommandBarHint>
          </CommandBarGroup>
        </CommandBar>

        <div class="ui-panel">
          <div class="ui-panel__header">
            <div>
              <h2 style={{ margin: '0 0 4px 0' }}>Controls</h2>
              <p class="ui-subtitle">
                Dense inputs and Kobalte primitives with project styling.
              </p>
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.Item>Edit</DropdownMenu.Item>
                  <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item>Delete</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div class="ui-panel__body ui-stack">
            <TextField
              description="Shown in routing and analytics views."
              label="Backend Name"
              value="OpenAI Primary"
            >
              <Button variant="primary">Save</Button>
            </TextField>

            <FieldRow>
              <Select
                label="Primary Route"
                onChange={setSelected}
                options={[
                  { value: 'analytics', label: 'Analytics' },
                  { value: 'users', label: 'Users' },
                  { value: 'scripts', label: 'Scripts' },
                ]}
                value={selected()}
              />
              <Tooltip.Root>
                <Tooltip.Trigger class="ui-button">Hover hint</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content>
                    Long values should still stay readable in dense layouts.
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </FieldRow>

            <div class="ui-cluster">
              <Checkbox defaultChecked label="Active only" />
              <Switch defaultChecked label="Auto refresh" />
            </div>

            <Tabs.Root defaultValue="request">
              <Tabs.List aria-label="Editor tabs">
                <Tabs.Trigger value="request">Request</Tabs.Trigger>
                <Tabs.Trigger value="response">Response</Tabs.Trigger>
                <Tabs.Trigger value="test">Test</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="request">
                Request transform settings and headers.
              </Tabs.Content>
              <Tabs.Content value="response">
                Response inspection and fallback rules.
              </Tabs.Content>
              <Tabs.Content value="test">
                Console output, sample payloads, and validation feedback.
              </Tabs.Content>
            </Tabs.Root>

            <div class="ui-cluster">
              <Popover.Root>
                <Popover.Trigger>Show Meta</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content>
                    <Popover.Title>Backend metadata</Popover.Title>
                    <Popover.Description>
                      Compact metadata clusters live in popovers when space is
                      tight.
                    </Popover.Description>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
            </div>
          </div>
        </div>

        <Alert title="Migration note" tone="warning">
          Wrapper components should replace direct primitive usage before
          route-level refactors begin.
        </Alert>

        <Dialog.Root onOpenChange={setDialogOpen} open={dialogOpen()}>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content>
              <div class="ui-dialog__header">
                <div>
                  <Dialog.Title>Compact Dialog</Dialog.Title>
                  <Dialog.Description>
                    Dense forms should still remain keyboard-friendly.
                  </Dialog.Description>
                </div>
              </div>
              <div class="ui-dialog__body ui-stack">
                <TextField label="User Name" value="ops-admin" />
                <TextField
                  label="Notes"
                  multiline
                  value="This dialog mirrors the future add/edit user workflow in a more compact form."
                />
              </div>
              <div class="ui-dialog__footer">
                <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => setDialogOpen(false)} variant="primary">
                  Save
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    );
  },
};
