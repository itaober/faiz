import config from '@itaober/prettier-config';

const prettierConfig = {
  ...config,
  // Keep formatting deterministic with the compatible plugins installed in this repo.
  plugins: config.plugins.filter(plugin => plugin === 'prettier-plugin-packagejson'),
};

export default prettierConfig;
