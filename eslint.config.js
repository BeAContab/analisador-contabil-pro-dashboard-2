import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'graphify-out',
      '.venv',
      'arquivos_de_exemplo',
      'brain',
      '.vercel',
      'coverage'
    ]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // eslint-plugin-react-hooks 7 (necessario para suportar eslint 10, ver
      // package.json) adicionou esta regra como erro por padrao. Ela pega
      // varios padroes de "sincronizar estado derivado via effect" ja
      // existentes no projeto (CompanyCard, DataTable, ChatbotFab) que
      // funcionam corretamente hoje - rebaixado para warning ate serem
      // revisados e refatorados de proposito, em vez de travar o lint agora.
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Legado: muitos parametros de callback/regex nao usados por design nas
      // funcoes de analise (analysisN(rows), matchAll, etc). Sinaliza so o que
      // realmente indica bug (variaveis nunca lidas), sem forcar underscore-prefix
      // em toda a base existente.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  eslintConfigPrettier
);
