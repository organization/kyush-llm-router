import '../src/ui/styles.css';

const withWorkbenchGlobals = (Story: () => unknown, context: { globals: { theme?: string; density?: string } }) => {
  const theme = context.globals.theme ?? 'system';
  const density = context.globals.density ?? 'dense';

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = density;

  return (
    <div class="sb-workbench">
      <Story />
    </div>
  );
};

export const decorators = [withWorkbenchGlobals];

export const globalTypes = {
  theme: {
    name: 'Theme',
    defaultValue: 'system',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'system', title: 'System' },
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
      ],
    },
  },
  density: {
    name: 'Density',
    defaultValue: 'dense',
    toolbar: {
      icon: 'sidebaralt',
      items: [
        { value: 'dense', title: 'Dense' },
        { value: 'regular', title: 'Regular' },
      ],
    },
  },
};

export const parameters = {
  layout: 'fullscreen',
  controls: {
    expanded: true,
  },
  backgrounds: {
    disable: true,
  },
  a11y: {
    test: 'todo',
  },
  viewport: {
    viewports: {
      narrowConsole: {
        name: 'Narrow Console',
        styles: { width: '960px', height: '900px' },
      },
      wideConsole: {
        name: 'Wide Console',
        styles: { width: '1440px', height: '900px' },
      },
    },
    defaultViewport: 'wideConsole',
  },
};
