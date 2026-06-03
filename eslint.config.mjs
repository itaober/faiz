import getESLintConfig from '@itaober/eslint-config';
import nextConfig from 'eslint-config-next';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

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

// eslint-config-next and @itaober/eslint-config each register react/react-hooks/
// import as their own plugin instances. eslint-config-next 16 scopes its
// definitions to a `files` glob, so simply stripping them from one config leaves
// the other's rules orphaned ("could not find plugin react"). Strip them from
// BOTH and register a single shared instance here instead.
const sharedPlugins = {
  plugins: {
    react: reactPlugin,
    'react-hooks': reactHooksPlugin,
    import: importPlugin,
  },
};

const eslintConfig = [
  ...filterDuplicatePlugins(nextConfig, DUPLICATE_PLUGIN_LIST),
  sharedPlugins,
  {
    ignores: [
      '.worktrees/**',
      '.claude/**',
      '.agents/**',
      '.playwright-cli/**',
      '.reference/**',
      '.next/**',
      'Design/**',
      'output/**',
      'skills-lock.json',
    ],
  },
  ...filterDuplicatePlugins(getESLintConfig(), DUPLICATE_PLUGIN_LIST),
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Test runner scripts print their results to stdout.
    files: ['tests/**'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
