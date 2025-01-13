module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
    '@babel/preset-typescript',
    '@babel/preset-react',
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-private-methods',
    '@babel/plugin-syntax-dynamic-import',
    ['@babel/plugin-transform-runtime', {
      corejs: 3,
    }],
    'babel-plugin-typescript-to-proptypes',
    'babel-plugin-dynamic-import-node',
    'babel-plugin-lodash',
    '@emotion/babel-plugin',
  ],
  env: {
    development: {
      plugins: ['react-hot-loader/babel'],
    },
    production: {
      plugins: ['babel-plugin-jsx-remove-data-test-id'],
    },
  },
}; 