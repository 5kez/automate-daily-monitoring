module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  plugins: ['react', 'react-hooks', 'react-refresh'],
  rules: {
    // React specific rules
    'react/prop-types': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/display-name': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // Code quality
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-debugger': 'error',
    'prefer-const': 'warn',
    'no-var': 'error',
    
    // Best practices
    'eqeqeq': ['warn', 'always'],
    'curly': ['warn', 'all'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',
    
    // ES6+
    'arrow-body-style': ['warn', 'as-needed'],
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'object-shorthand': 'warn',
    
    // Formatting (handled by Prettier, but keeping some)
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'comma-dangle': ['warn', 'never']
  },
  ignorePatterns: [
    'dist',
    'build',
    'node_modules',
    '*.config.js',
    '*.config.cjs'
  ]
};
