const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'assets'),
    //publicPath: "/planet-gl/"
  },
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
        'file-loader',
        ],
      },
    ]
  },
  devServer: {
    contentBase: './assets',
  },
};
