import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'test-results/**', 'playwright-report/**', 'docs/specification/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly' } } },
  { files: ['**/*.tsx'], plugins: { 'react-hooks': hooks }, rules: { ...hooks.configs.recommended.rules } }
)

