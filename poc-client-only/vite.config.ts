import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pagesはプロジェクトサイトとして https://<owner>.github.io/<repo>/ で配信されるため、
  // CIビルド時のみ base をリポジトリ名のサブパスに切り替える(ローカル開発時は '/' のまま)。
  base: process.env.GITHUB_PAGES === 'true' ? '/katahimo-saas-poc/' : '/',
})
