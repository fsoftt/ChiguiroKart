import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      // Allow intentionally unused parameters when prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Node-only build scripts (not part of the browser tsconfig)
    files: ['scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
)
