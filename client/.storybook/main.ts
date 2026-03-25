export default {
  framework: {
    name: 'storybook-solidjs-vite',
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  docs: {
    autodocs: 'tag',
  },
};
