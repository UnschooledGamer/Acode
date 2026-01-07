// const path = require('path');
// const { rspack } = require('@rspack/core')
// const oldRules = [
//   {
//     test: /\.tsx?$/,
//     exclude: /node_modules/,
//     use: [
//       'html-tag-js/jsx/tag-loader.js',
//       {
//         loader: 'babel-loader',
//         options: {
//           presets: ['@babel/preset-env', '@babel/preset-typescript'],
//         },
//       },
//       {
//         loader: 'ts-loader',
//         options: {
//           transpileOnly: true, // Skip type checking for faster builds
//         },
//       },
//     ],
//   },
//   {
//     test: /\.(hbs|md)$/,
//     use: ['raw-loader'],
//   },
//   {
//     test: /\.m.(sa|sc|c)ss$/,
//     use: [
//       'raw-loader',
//       'postcss-loader',
//       'sass-loader',
//     ],
//   },
//   {
//     test: /\.(png|svg|jpg|jpeg|ico|ttf|webp|eot|woff|webm|mp4|webp|wav)(\?.*)?$/,
//     type: "asset/resource",
//   },
//   {
//     test: /(?<!\.m)\.(sa|sc|c)ss$/,
//     use: [
//       rspack.CssExtractRspackPlugin.loader,
//       'css-loader',
//       'postcss-loader',
//       'sass-loader',
//     ],
//     type: 'javascript/auto'
//   },
// ];

const path = require('path');
const { rspack } = require('@rspack/core');

module.exports = (env, options) => {
  const { mode = 'development' } = options;
  const prod = mode === 'production';

  const rules = [
    // TypeScript/TSX files - Custom JSX loader + SWC
    {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        // First: Transform JSX to tag() calls
        path.resolve(__dirname, 'html-tag-jsx-loader.js'),
        // Then: Use SWC for TypeScript and ES6+ transpilation
        {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true, // Still parse JSX syntax (before it gets transformed)
              },
              target: 'es2015',
            },
            // env: {
            //   mode: 'usage',
            //   coreJs: '3.22',
            //   targets: 'defaults',
            // },
          },
        },
      ],
    },
    // JavaScript files
    {
      test: /\.m?js$/,
      oneOf: [
        // Node modules - use builtin:swc-loader only
        {
          include: /node_modules/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                  },
                  target: 'es2015',
                },
                // env: {
                //   targets: 'defaults',
                // },
              },
            },
          ],
        },
        // Source JS files - Custom JSX loader + SWC (JSX will be removed first)
        {
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                    // NO jsx - it's already removed by custom loader below
                  },
                  target: 'es2015',
                },
                // env: {
                //   mode: 'usage',
                //   coreJs: '3.22',
                //   targets: 'defaults',
                // },
              },
            },
            // First: Transform JSX to tag() calls
            path.resolve(__dirname, 'html-tag-jsx-loader.js'),
            // Then: Use SWC for ES6+ transpilation
            // {
            //   loader: 'builtin:swc-loader',
            //   options: {
            //     jsc: {
            //       parser: {
            //         syntax: 'ecmascript',
            //         // JSX is already transformed by custom loader above
            //       },
            //       target: 'es2015',
            //     },
            //     // env: {
            //     //   mode: 'usage',
            //     //   coreJs: '3.22',
            //     //   targets: 'defaults',
            //     // },
            //   },
            // },
          ],
        },
      ],
    },
    // Handlebars and Markdown files
    {
      test: /\.(hbs|md)$/,
      type: 'asset/source',
    },
    // Module CSS/SCSS (with .m prefix)
    {
      test: /\.m\.(sa|sc|c)ss$/,
      use: [
        'raw-loader',
        'postcss-loader',
        'sass-loader',
      ],
      type: 'javascript/auto',
    },
    // Asset files
    {
      test: /\.(png|svg|jpg|jpeg|ico|ttf|webp|eot|woff|webm|mp4|wav)(\?.*)?$/,
      type: 'asset/resource',
    },
    // Regular CSS/SCSS files
    {
      test: /(?<!\.m)\.(sa|sc|c)ss$/,
      use: [
        rspack.CssExtractRspackPlugin.loader,
        'css-loader',
        'postcss-loader',
        'sass-loader',
      ],
      type: 'javascript/auto',
    },
  ];

  const main = {
    mode,
    entry: {
      main: './src/main.js',
      console: './src/lib/console.js',
      searchInFilesWorker: './src/sidebarApps/searchInFiles/worker.js',
    },
    output: {
      path: path.resolve(__dirname, 'www/build/'),
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      assetModuleFilename: '[name][ext]',
      publicPath: '/build/',
      clean: true,
    },
    module: {
      rules,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      fallback: {
        path: require.resolve('path-browserify'),
        crypto: false,
      },
      modules: ['node_modules', 'src'],
    },
    plugins: [
      new rspack.CssExtractRspackPlugin({
        filename: '[name].css',
      }),
    ],
  };

  return [main];
};