import { getMallProductReviews, type ProductReviewItem } from '../../utils/api'

interface ReviewRow extends ProductReviewItem {
  id: string
  score: number
  content: string
  images: string[]
  nickname: string
  avatar: string
  createTime: string
}

function normalizeReviewList(raw: unknown): ReviewRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = (item || {}) as Record<string, unknown>
      const imagesRaw = row.images
      return {
        id: String(row.id || ''),
        score: Math.max(0.5, Math.min(5, Number(row.score || 5) || 5)),
        content: String(row.content || ''),
        images: Array.isArray(imagesRaw) ? imagesRaw.map((img) => String(img || '')).filter(Boolean) : [],
        nickname: String(row.nickname || '农场用户'),
        avatar: String(row.avatar || ''),
        createTime: String(row.createTime || row.create_time || ''),
      }
    })
    .filter((item) => !!item.id)
}

Page({
  data: {
    productId: '',
    productTitle: '',
    list: [] as ReviewRow[],
    page: 1,
    pageSize: 10,
    total: 0,
    loading: false,
    loadingMore: false,
    finished: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const productId = String(query.id || '')
    const productTitle = decodeURIComponent(String(query.title || ''))
    this.setData({
      productId,
      productTitle,
    })
    if (productTitle) {
      wx.setNavigationBarTitle({ title: '买家评价' })
    }
    this.fetchList(1, true)
  },

  onReachBottom() {
    if (this.data.loading || this.data.loadingMore || this.data.finished) return
    this.fetchList(this.data.page + 1, false)
  },

  async fetchList(nextPage = 1, replace = false) {
    const productId = String(this.data.productId || '')
    if (!productId) return
    const loadingKey = replace ? 'loading' : 'loadingMore'
    this.setData({ [loadingKey]: true } as Record<string, boolean>)
    try {
      const resp = (await getMallProductReviews(productId, nextPage, this.data.pageSize)) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '评价加载失败'), icon: 'none' })
        return
      }
      const payload = ((resp.data || {}) as Record<string, unknown>) || {}
      const rows = normalizeReviewList(payload.list)
      const total = Number(payload.total || 0)
      const list = replace ? rows : this.data.list.concat(rows)
      this.setData({
        list,
        total,
        page: nextPage,
        finished: list.length >= total || rows.length < this.data.pageSize,
      })
    } catch (_) {
      wx.showToast({ title: '评价加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  onPreviewImageTap(e: WechatMiniprogram.TouchEvent) {
    const dataset = (e.currentTarget && e.currentTarget.dataset) || {}
    const reviewIndex = Number((dataset as Record<string, unknown>).reviewIndex || -1)
    const imageIndex = Number((dataset as Record<string, unknown>).imageIndex || 0)
    const review = this.data.list[reviewIndex]
    const images = review && Array.isArray(review.images) ? review.images : []
    const src = images[imageIndex] || ''
    if (!src) return
    wx.previewImage({
      current: src,
      urls: images.length ? images : [src],
    })
  },
})
