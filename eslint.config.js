const nodeGlobals = Object.fromEntries([
  'process','Buffer','__dirname','__filename','console','setTimeout','clearTimeout','setInterval','clearInterval',
  'setImmediate','clearImmediate','URL','URLSearchParams','AbortController','AbortSignal','fetch','structuredClone',
  'TextEncoder','TextDecoder','queueMicrotask','Response','Request','Headers','FormData','Blob','File','ReadableStream','WritableStream','TransformStream','CompressionStream','DecompressionStream'
].map(name => [name, 'readonly']));

export default [
  { ignores: ['**/node_modules/**', 'app/build/**', 'build/**'] },
  {
    files: ['apps/**/*.js', 'packages/**/*.js', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
];
