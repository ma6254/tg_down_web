import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn 生成的组件会同时导出组件与 cva variants，这是既定写法，
    // 不适用 Fast Refresh 的「一个文件只导出组件」约束。
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // PicViewer 是从 NewsGlean 整体移植的图片查看器：缩放/拖拽/适配屏幕
    // 依赖 ref 同步和「打开时重置」副作用，保持原实现避免交互行为漂移。
    files: [
      'src/components/PicViewer/**/*.{ts,tsx}',
      'src/components/PicViewerMobile/**/*.{ts,tsx}',
    ],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
