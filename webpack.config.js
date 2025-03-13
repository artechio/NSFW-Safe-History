const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { DefinePlugin } = require('webpack');
const packageJson = require('./package.json');

module.exports = {
  mode: 'production',
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
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new DefinePlugin({
      'VERSION': JSON.stringify(packageJson.version)
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'options.html', to: 'options.html' },
        { from: 'content.css', to: 'content.css' },
        { from: 'assets', to: 'assets' }
      ]
    })
  ]
}; 