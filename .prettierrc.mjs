import config from '@itaober/prettier-config';

const prettierConfig = {
  ...config,
  plugins: config.plugins.filter(plugin => plugin === 'prettier-plugin-packagejson'),
};

export default prettierConfig;
