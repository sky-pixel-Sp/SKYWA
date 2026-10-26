import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', 'app/build/**', 'build/**'] },
  {
    files: ['apps/**/*.js', 'packages/**/*.js', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
];
