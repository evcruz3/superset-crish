const path = require('path');

module.exports = {
  entry: './src/index', // Entry point for your plugin
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'plugin.js', // Output filename for the plugin
    library: 'MySupersetPlugin', // Name of your plugin
    libraryTarget: 'umd', // Ensure it's a UMD module so it can be loaded in multiple environments
    globalObject: 'this', // Necessary for UMD in browser environments
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'], // Extensions for module resolution
    fallback: {
        fs: false,
        vm: require.resolve('vm-browserify'),
        path: false,
        ...(process.env.NODE_ENV === 'development' ? { buffer: require.resolve('buffer/') } : {}), // Fix legacy-plugin-chart-paired-t-test broken Story
    },
},
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/, // Updated to handle both JS/JSX and TS/TSX files
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/, // For processing CSS files
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i, // For processing images
        type: 'asset/resource',
      },
    ],
  },
  devtool: 'source-map', // Include source maps for easier debugging
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development', // Dynamic mode based on environment
};