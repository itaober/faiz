import { FlatCompat } from '@eslint/eslintrc';
import getESLintConfig from '@itaober/eslint-config';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

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

const eslintConfig = [...compat.extends('next'), ...customConfig];

export default eslintConfig;
