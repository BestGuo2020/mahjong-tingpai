import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function normalizeSiteUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.host) throw new Error('unsupported protocol')
    return `${url.protocol}//${url.host}`
  } catch {
    console.warn('[seo] VITE_SITE_URL 不是有效的绝对网址，已跳过 canonical 和 sitemap 生成。')
    return ''
  }
}

function seoBuildPlugin(siteUrl) {
  return {
    name: 'seo-build-files',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!siteUrl) return html
        const isBaibian = context.filename.replaceAll('\\', '/').endsWith('/baibian/index.html')
        const canonical = `${siteUrl}${isBaibian ? '/baibian/' : '/'}`
        return html.replace('</head>', `    <link rel="canonical" href="${canonical}" />\n    <meta property="og:url" content="${canonical}" />\n  </head>`)
      }
    },
    closeBundle() {
      mkdirSync('dist', { recursive: true })
      const robots = ['User-agent: *', 'Allow: /', siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '', ''].filter(Boolean).join('\n')
      writeFileSync('dist/robots.txt', robots)
      if (!siteUrl) return
      const today = new Date().toISOString().slice(0, 10)
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n  <url><loc>${siteUrl}/baibian/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n</urlset>\n`
      writeFileSync('dist/sitemap.xml', sitemap)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)
  return {
    plugins: [vue(), seoBuildPlugin(siteUrl)],
    build: {
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
          baibian: resolve(process.cwd(), 'baibian/index.html')
        }
      }
    }
  }
})
