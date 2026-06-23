/* eslint-disable */
const path = require('path');

// Vortex extensions are bundled to a single index.js that runs inside Vortex's
// Electron renderer. The vortex-api and Node/Electron built-ins are provided by
// the host at runtime, so they must be marked external (not bundled).
module.exports = {
  mode: 'production',
  // Keep output readable-ish and avoid eval (Vortex CSP forbids it).
  devtool: 'source-map',
  optimization: {
    // Easier to debug a deployed extension; size is not a concern here.
    minimize: false,
  },
  entry: {
    index: './src/index.ts',
  },
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  externals: {
    'vortex-api': 'vortex-api',
    bluebird: 'bluebird',
    'winapi-bindings': 'winapi-bindings',
    turbowalk: 'turbowalk',
  },
};
