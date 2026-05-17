import getESLintConfig from '@itaober/eslint-config';
import nextConfig from 'eslint-config-next';

export function filterDuplicatePlugins(config, duplicatePluginList) {
  return config.map(item => {
    if (!item.plugins) return item;

    const filteredPlugins = Object.fromEntries(
      Object.entries(item.plugins).filter(([key]) => !duplicatePluginList.includes(key)),
    );

    return {
      ...item,
      plugins: filteredPlugins,
    };
  });
}

const DUPLICATE_PLUGIN_LIST = ['react', 'react-hooks', 'import'];

const customConfig = filterDuplicatePlugins(getESLintConfig(), DUPLICATE_PLUGIN_LIST);

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      '.worktrees/**',
      '.claude/**',
      '.agents/**',
      '.playwright-cli/**',
      'Design/**',
      'output/**',
      'skills-lock.json',
    ],
  },
  ...customConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
