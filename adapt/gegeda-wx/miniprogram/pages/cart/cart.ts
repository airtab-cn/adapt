import { deleteCartItem, getCartItems, setBuyNowDraft, updateCartItem } from '../../utils/api'

/** 左滑露出的删除区宽度（rpx），需与 wxss 中 .swipe-delete 宽度一致 */
const SWIPE_DELETE_RX = 160
const SWIPE_SNAP_RX = 80

interface CartLine {
  id: string
  productId: string
  title: string
  spec: string
  skuName: string
  deliveryMode: string
  img: string
  price: string
  originPrice: string
  shippingFee: string
  quantity: number
  selected: boolean
  offsetX: number
}

function parseMoney(s: string): number {
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatMoney(n: number): string {
  return n.toFixed(2)
}

function normalizeLines(list: unknown): CartLine[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const row = x as Record<string, unknown>
      const rawId = String(row.id || '')
      const rawProductId = String(row.productId || '')
      const fallbackProductId = rawId.includes('__') ? rawId.split('__')[0] : ''
      const skuName = String(row.skuName || row.sku_name || '默认规格')
      const deliveryMode = String(row.deliveryMode || row.delivery_mode || '')
      return {
        id: rawId,
        productId: rawProductId || fallbackProductId,
        title: String(row.title || ''),
        spec: `规格：${skuName}${deliveryMode ? ` ? 配送：${deliveryMode}` : ''}`,
        skuName,
        deliveryMode,
        img: String(row.img || '/images/ad.jpg'),
        price: String(row.price || '0.00'),
        originPrice: String(row.originPrice || ''),
        shippingFee: String(row.shippingFee || row.shipping_fee || '0.00'),
        quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
        selected: row.selected !== false,
        offsetX: 0,
      }
    })
    .filter((l) => !!l.id)
}

Page({
  data: {
    items: [] as CartLine[],
    allSelected: false,
    totalPrice: '0.00',
    selectedCount: 0,
    rpxRatio: 1,
  },

  _touchRowId: '' as string,
  _touchStartX: 0,
  _touchStartY: 0,
  _touchStartOffset: 0,
  _swipeLockAxis: '' as '' | 'h' | 'v',

  onLoad() {
    const sys = wx.getSystemInfoSync()
    const rpxRatio = 750 / (sys.windowWidth || 375)
    this.setData({ rpxRatio })
    this.fetchCart()
  },

  onShow() {
    this.fetchCart()
  },

  async onPullDownRefresh() {
    try {
      await this.fetchCart()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async fetchCart() {
    try {
      const resp = (await getCartItems()) as Record<string, unknown>
      const rows = normalizeLines(resp.data)
      this.setData({ items: rows })
      this.recalcSummary()
    } catch (_) {
      this.setData({ items: [] })
      this.recalcSummary()
    }
  },

  recalcSummary() {
    const items = this.data.items as CartLine[]
    const allSelected = items.length > 0 && items.every((i) => i.selected)
    let total = 0
    let selectedCount = 0
    for (const i of items) {
      if (!i.selected) continue
      total += parseMoney(i.price) * i.quantity
      selectedCount += i.quantity
    }
    this.setData({
      allSelected,
      totalPrice: formatMoney(total),
      selectedCount,
    })
  },

  async persistLine(line: CartLine) {
    await updateCartItem({ id: line.id, quantity: line.quantity, selected: line.selected })
  },

  closeOtherSlides(exceptId: string) {
    const items = (this.data.items as CartLine[]).map((i) =>
      i.id === exceptId ? i : { ...i, offsetX: 0 },
    )
    this.setData({ items })
  },

  onRowTouchStart(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset.id as string) || ''
    if (!id) return
    const t = e.touches[0]
    const item = (this.data.items as CartLine[]).find((x) => x.id === id)
    if (!item) return
    this._touchRowId = id
    this._touchStartX = t.clientX
    this._touchStartY = t.clientY
    this._touchStartOffset = item.offsetX
    this._swipeLockAxis = ''
    this.closeOtherSlides(id)
  },

  onRowTouchMove(e: WechatMiniprogram.TouchEvent) {
    const id = this._touchRowId
    if (!id) return
    const t = e.touches[0]
    const dx = t.clientX - this._touchStartX
    const dy = t.clientY - this._touchStartY
    if (this._swipeLockAxis === '') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this._swipeLockAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
    }
    if (this._swipeLockAxis !== 'h') return

    const ratio = this.data.rpxRatio || 1
    const deltaRpx = dx * ratio
    let next = this._touchStartOffset + deltaRpx
    if (next > 0) next = 0
    if (next < -SWIPE_DELETE_RX) next = -SWIPE_DELETE_RX

    const items = (this.data.items as CartLine[]).map((i) =>
      i.id === id ? { ...i, offsetX: next } : i,
    )
    this.setData({ items })
  },

  onRowTouchEnd() {
    const id = this._touchRowId
    this._touchRowId = ''
    this._swipeLockAxis = ''
    if (!id) return
    const items = [...(this.data.items as CartLine[])]
    const idx = items.findIndex((x) => x.id === id)
    if (idx < 0) return
    const cur = items[idx].offsetX
    let snap = 0
    if (cur < -SWIPE_SNAP_RX) snap = -SWIPE_DELETE_RX
    items[idx] = { ...items[idx], offsetX: snap }
    this.setData({ items })
  },

  async onToggleItem(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const items = (this.data.items as CartLine[]).map((i) =>
      i.id === id ? { ...i, selected: !i.selected, offsetX: 0 } : { ...i, offsetX: 0 },
    )
    this.setData({ items })
    this.recalcSummary()
    const line = items.find((i) => i.id === id)
    if (!line) return
    await this.persistLine(line)
  },

  async onToggleAll() {
    const next = !this.data.allSelected
    const items = (this.data.items as CartLine[]).map((i) => ({
      ...i,
      selected: next,
      offsetX: 0,
    }))
    this.setData({ items })
    this.recalcSummary()
    await Promise.all(items.map((i) => this.persistLine(i)))
  },

  async onQtyDelta(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const delta = Number(e.currentTarget.dataset.delta) || 0
    const items = (this.data.items as CartLine[]).map((i) => {
      if (i.id !== id) return { ...i, offsetX: 0 }
      let q = i.quantity + delta
      if (q < 1) {
        wx.showToast({ title: '至少保留 1 件', icon: 'none' })
        q = 1
      }
      return { ...i, quantity: q, offsetX: 0 }
    })
    this.setData({ items })
    this.recalcSummary()
    const line = items.find((i) => i.id === id)
    if (!line) return
    await this.persistLine(line)
  },

  onDeleteTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    wx.showModal({
      title: '删除商品',
      content: '确定从购物车中删除该商品吗？',
      confirmColor: '#e53935',
      success: async (res) => {
        if (!res.confirm) return
        await deleteCartItem(id)
        const items = (this.data.items as CartLine[]).filter((i) => i.id !== id)
        this.setData({ items })
        this.recalcSummary()
        wx.showToast({ title: '已删除', icon: 'success', duration: 1200 })
      },
    })
  },

  onOpenDetail(e: WechatMiniprogram.TouchEvent) {
    const dataset = e.currentTarget.dataset as { productId?: string }
    const productId = String(dataset.productId || '')
    if (!productId) {
      wx.showToast({ title: '商品信息不存在', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${encodeURIComponent(productId)}`,
    })
  },

  onSettle() {
    const selected = (this.data.items as CartLine[]).filter((item) => item.selected)
    if (!selected.length) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    const first = selected[0]
    const totalQty = selected.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
    const totalShipping = selected.reduce((sum, item) => sum + parseMoney(item.shippingFee), 0)
    const deliveryModes = selected.map((item) => item.deliveryMode).filter(Boolean)
    const deliveryMode = deliveryModes.length && deliveryModes.every((mode) => mode === deliveryModes[0]) ? deliveryModes[0] : (deliveryModes.length ? '多种配送' : '')
    const title = selected.length > 1 ? `${first.title}等${selected.length}件商品` : first.title
    setBuyNowDraft({
      productId: first.productId,
      skuName: selected.length > 1 ? '多规格' : first.skuName,
      title,
      img: first.img,
      price: first.price,
      originPrice: first.originPrice || first.price,
      quantity: totalQty,
      deliveryMode,
      shippingFee: formatMoney(totalShipping),
      cartItemIds: selected.map((item) => item.id),
      items: selected.map((item) => ({
        cartItemId: item.id,
        productId: item.productId,
        skuName: item.skuName,
        title: item.title,
        img: item.img,
        price: item.price,
        originPrice: item.originPrice || item.price,
        quantity: item.quantity,
        deliveryMode: item.deliveryMode,
        shippingFee: item.shippingFee || '0.00',
      })),
    })
    wx.navigateTo({ url: '/pages/order-submit/order-submit' })
  },
})
