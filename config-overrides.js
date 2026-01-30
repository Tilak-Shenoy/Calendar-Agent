const webpack = require('webpack');

module.exports = function override(config, env) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "util": require.resolve("util/"),
    "crypto": require.resolve("crypto-browserify"),
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert/"),
    "url": require.resolve("url/"),
    "os": require.resolve("os-browserify/browser"),
    "path": require.resolve("path-browserify"),
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  return config;
};
