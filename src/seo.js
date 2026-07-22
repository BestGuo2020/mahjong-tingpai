const PAGE_SEO = {
  standard: {
    path: '/',
    title: '麻将听牌计算器 - 在线计算全部听牌 | 听见',
    description: '免费在线麻将听牌计算器，支持手牌代码粘贴和牌面点选，快速计算国标麻将标准牌型、七对、十三幺与全不靠的全部听牌。',
    keywords: '麻将听牌,听牌计算器,麻将计算器,国标麻将,七对,十三幺,全不靠',
    structuredName: '听见麻将听牌计算器'
  },
  baibian: {
    path: '/baibian/',
    title: '百变斗牌听牌与番数计算器 | 听见',
    description: '百变斗牌听牌与番数计算器：录入暗手、普通杠、癞子杠和场景条件，逐张计算可胡牌、理论番数、封顶番数及最佳拆分。',
    keywords: '百变斗牌,百变斗牌计算器,麻将番数计算器,麻将听牌,癞子麻将,听牌番数',
    structuredName: '百变斗牌听牌与番数计算器'
  }
}

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = url
}

function updateSeo(routeName) {
  const page = PAGE_SEO[routeName] || PAGE_SEO.standard
  const configuredOrigin = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')
  const origin = configuredOrigin || window.location.origin
  const canonical = new URL(page.path, `${origin}/`).href

  document.title = page.title
  setMeta('meta[name="description"]', { name: 'description', content: page.description })
  setMeta('meta[name="keywords"]', { name: 'keywords', content: page.keywords })
  setMeta('meta[property="og:title"]', { property: 'og:title', content: page.title })
  setMeta('meta[property="og:description"]', { property: 'og:description', content: page.description })
  setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title })
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description })
  setCanonical(canonical)

  let structuredData = document.head.querySelector('script[data-runtime-seo]')
  if (!structuredData) {
    structuredData = document.createElement('script')
    structuredData.type = 'application/ld+json'
    structuredData.dataset.runtimeSeo = ''
    document.head.appendChild(structuredData)
  }
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: page.structuredName,
    url: canonical,
    description: page.description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    inLanguage: 'zh-CN',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' }
  })
}

export function installSeo(router) {
  let initialNavigation = true
  router.afterEach(route => {
    updateSeo(route.name)

    // gtag 的 config 会自动记录首次访问；这里只补报 SPA 内部路由切换。
    if (!initialNavigation && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: route.fullPath
      })
    }
    initialNavigation = false
  })
}
