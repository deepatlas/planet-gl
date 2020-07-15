const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'assets/javascripts')
  },
  devServer: {
    contentBase: './assets',
  },
};
