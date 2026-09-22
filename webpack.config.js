const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  devtool: false,
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    options: './src/options.js',
    contentScript: './src/contentScript.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'options.html', to: 'options.html' },
        { from: 'offscreen.html', to: 'offscreen.html' },
        { from: 'src/offscreen.js', to: 'offscreen.js' },
        { from: 'content.css', to: 'content.css' },
        { from: 'assets', to: 'assets' },
        { from: 'node_modules/nsfwjs/dist/nsfwjs.min.js', to: 'assets/vendor/nsfwjs.min.js' }
      ]
    })
  ]
};
