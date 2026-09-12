import { getFavoriteProducts } from '../../utils/api'

interface FavoriteGoodsItem {
  id: string
  name: string
  price: string
  oldPrice: string
  cover: string
  favoriteTime: string
}

function toRow(item: Record<string, unknown>): FavoriteGoodsItem {
  return {
    id: String(item.id || ''),
    name: String(item.title || item.name || ''),
    price: String(item.price || '0.00'),
    oldPrice: String(item.originPrice || item.origin_price || item.price || '0.00'),
    cover: String(item.cover || item.img || '/images/ad.jpg'),
    favoriteTime: String(item.favoriteTime || item.favorite_time || ''),
  }
}

Page({
  data: {
    goodsList: [] as FavoriteGoodsItem[],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadingText: '上拉加载更多',
  },

  onShow() {
    this.resetAndLoad()
  },

  onPullDownRefresh() {
    this.resetAndLoad().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadPage(this.data.page + 1)
  },

  async resetAndLoad() {
    this.setData({
      goodsList: [],
      page: 1,
      hasMore: true,
      loadingText: '加载中...',
    })
    await this.loadPage(1)
  },

  async loadPage(page: number) {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const resp = (await getFavoriteProducts(page, this.data.pageSize)) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '获取收藏失败'), icon: 'none' })
        this.setData({ loadingText: '加载失败，稍后重试' })
        return
      }

      const payload = (resp.data || {}) as Record<string, unknown>
      const rows = Array.isArray(payload.list) ? payload.list : []
      const mapped = rows.map((item) => toRow((item || {}) as Record<string, unknown>)).filter((item) => !!item.id)
      const nextList = page === 1 ? mapped : this.data.goodsList.concat(mapped)
      const hasMore = !!payload.hasMore

      this.setData({
        goodsList: nextList,
        page,
        hasMore,
        loadingText: hasMore ? '上拉加载更多' : '没有更多了',
      })
    } catch (_) {
      wx.showToast({ title: '获取收藏失败，请重试', icon: 'none' })
      this.setData({ loadingText: '加载失败，稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onGoodsTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },
})
