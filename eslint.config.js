import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import vueTsEslintConfig from '@vue/eslint-config-typescript'


export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __APP_BUILD_TIME__: 'readonly'
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['src/views/**/*.vue'], // 匹配 views 目录下的所有 .vue 文件
    rules: {
      'vue/multi-word-component-names': 'off', // 关闭多单词组件名限制
    },
  },
  {
    rules: {
      // 允许接口通过 extends 继承单个父类型
      '@typescript-eslint/no-empty-object-type': ['error', {
        allowInterfaces: 'with-single-extends'
      }],
    },
  },
  ...vueTsEslintConfig(),
  skipFormatting,
])
