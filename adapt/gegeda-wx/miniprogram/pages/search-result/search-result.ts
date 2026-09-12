import { getMallProducts } from '../../utils/api'

interface SearchProduct {
  id: string
  title: string
  tags: string[]
  price: string
  originPrice: string
  img: string
}

function normalizeKeyword(raw: string): string {
  return (raw || '').trim()
}

function toProduct(item: Record<string, unknown>): SearchProduct {
  const rawTags = item.tags
  let tags: string[] = []
  if (Array.isArray(rawTags)) {
    tags = rawTags.map((tag) => String(tag || '')).filter(Boolean)
  } else if (rawTags !== undefined && rawTags !== null) {
    tags = String(rawTags)
      .replace(/，/g, ',')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return {
    id: String(item.id || ''),
    title: String(item.title || ''),
    tags,
    price: String(item.price || '0.00'),
    originPrice: String(item.originPrice || item.origin_price || ''),
    img: String(item.cover || item.img || '/images/ad.jpg'),
  }
}

Page({
  data: {
    keyword: '',
    resultTitle: '',
    results: [] as SearchProduct[],
  },

  async onLoad(options: Record<string, string | undefined>) {
    const keyword = normalizeKeyword(decodeURIComponent(options.keyword || ''))
    this.setData({
      keyword,
      resultTitle: keyword ? `关键词：${keyword}` : '全部商品',
    })
    await this.applySearch(keyword)
  },

  onKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value || '' })
  },

  async onKeywordConfirm() {
    const keyword = normalizeKeyword(this.data.keyword)
    this.setData({
      keyword,
      resultTitle: keyword ? `关键词：${keyword}` : '全部商品',
    })
    await this.applySearch(keyword)
  },

  async applySearch(keyword: string) {
    wx.showLoading({ title: '搜索中', mask: true })
    try {
      const resp = (await getMallProducts({ keyword })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '搜索失败'), icon: 'none' })
        return
      }
      const rows = Array.isArray(resp.data) ? resp.data : []
      this.setData({ results: rows.map((item) => toProduct(item as Record<string, unknown>)) })
    } catch (_) {
      wx.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onProductTap(e: WechatMiniprogram.TouchEvent) {
    const id = ((e.currentTarget.dataset as { id?: string }).id || '') as string
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },
})
