// @ts-check
const js = require('@eslint/js');
const jest = require('eslint-plugin-jest');

module.exports = [
  // Base configuration
  js.configs.recommended,
  
  // Global ignores
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'optimized/',
      '*.min.js'
    ]
  },
  
  // Main configuration for all files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Node.js globals
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'writable',
        global: 'readonly',
        module: 'writable',
        process: 'readonly',
        require: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      // Disallow console in production code (but allow in tests)
      'no-console': ['error', { allow: ['error', 'warn'] }],
      
      // Code quality rules
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      
      // Best practices
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      
      // Style consistency
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'never'],
      'arrow-parens': ['error', 'as-needed'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      
      // Node.js specific
      'no-process-exit': 'off', // We use process.exit in CLI tools
      'no-sync': 'off' // We use execSync for git operations
    }
  },
  
  // Test files configuration
  {
    files: ['**/*.test.js', 'tests/**/*.js'],
    plugins: {
      jest
    },
    rules: {
      'no-console': 'off',
      ...jest.configs.recommended.rules
    }
  },
  
  // Scripts configuration
  {
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': ['error', { allow: ['log', 'error', 'warn'] }]
    }
  }
];