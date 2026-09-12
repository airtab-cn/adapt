import {
  addCartItem,
  setBuyNowDraft,
  clearMiniAuth,
  ensureMiniLogin,
  getMallProductDetail,
  hasMiniLogin,
  toggleProductFavorite,
} from '../../utils/api'
interface DetailSpecRow {
  label: string
  value: string
}
interface ProductSkuRow {
  name: string
  price: string
  originPrice: string
  stock: number
}
interface DeliveryOption {
  value: string
  label: string
}
interface ProductReviewItem {
  id: string
  score: number
  content: string
  images: string[]
  nickname: string
  avatar: string
  createTime: string
}
interface ProductDetail {
  id: string
  name: string
  price: string
  originPrice: string
  priceMin: string
  priceMax: string
  originPriceMin: string
  originPriceMax: string
  tags: string[]
  intro: string
  images: string[]
  detailHtml: string
  mayLike: { id: string; name: string; price: string; img: string }[]
  specRows: DetailSpecRow[]
  skuRows: ProductSkuRow[]
  deliveryOptions: DeliveryOption[]
  deliveryDesc: string
  shippingFee: string
  serviceRows: string[]
  monthlySales: string
  reviewCount: string
  reviewRate: string
  isFavorited: boolean
  reviewList: ProductReviewItem[]
}
const DEFAULT_DETAIL: ProductDetail = {
  id: '',
  name: '',
  price: '0.00',
  originPrice: '0.00',
  priceMin: '0.00',
  priceMax: '0.00',
  originPriceMin: '0.00',
  originPriceMax: '0.00',
  tags: [],
  intro: '',
  images: [],
  detailHtml: '',
  mayLike: [],
  specRows: [],
  skuRows: [],
  deliveryOptions: [],
  deliveryDesc: '',
  shippingFee: '0.00',
  serviceRows: [],
  monthlySales: '0',
  reviewCount: '0',
  reviewRate: '98%',
  isFavorited: false,
  reviewList: [],
}
function parseMoney(value: unknown): string {
  const n = Number(value)
  if (Number.isNaN(n) || n < 0) return '0.00'
  return n.toFixed(2)
}
function parsePriceNum(value: unknown): number {
  const n = Number(value)
  if (Number.isNaN(n) || n < 0) return 0
  return n
}
function normalizeSpecRows(raw: unknown): DetailSpecRow[] {
  if (!Array.isArray(raw)) return []
  const rows: DetailSpecRow[] = []
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const label = String(row.label || '').trim()
    const value = String(row.value || '').trim()
    if (!label) return
    rows.push({ label, value })
  })
  return rows
}
function normalizeSkuRows(raw: unknown): ProductSkuRow[] {
  if (!Array.isArray(raw)) return []
  const rows: ProductSkuRow[] = []
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const name = String(row.name || '').trim()
    if (!name) return
    rows.push({
      name,
      price: parseMoney(row.price),
      originPrice: parseMoney(row.originPrice || row.origin_price || row.price),
      stock: Math.max(Number(row.stock || 0) || 0, 0),
    })
  })
  return rows
}
function normalizeServiceRows(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item || '').trim()).filter(Boolean)
}
function normalizeDeliveryOptions(raw: unknown): DeliveryOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const text = item.trim()
        return text ? { value: text, label: text } : null
      }
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const value = String(row.value || row.key || row.code || row.label || '').trim()
      const label = String(row.label || row.name || value).trim()
      if (!value || !label) return null
      return { value, label }
    })
    .filter((x): x is DeliveryOption => !!x)
}

function normalizeDetailHtml(html: string): string {
  const raw = String(html || '').trim()
  if (!raw) return ''
  const responsiveImgStyle = 'max-width:100%;height:auto;display:block;box-sizing:border-box;'
  return raw.replace(/<img\b([^>]*)>/gi, (_match, attrs) => {
    let nextAttrs = String(attrs || '')
    nextAttrs = nextAttrs.replace(/\s(width|height)=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    if (/\sstyle=(["'])(.*?)\1/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\sstyle=(["'])(.*?)\1/i, (_styleMatch, quote, styleText) => {
        return ` style=${quote}${String(styleText || '')};${responsiveImgStyle}${quote}`
      })
    } else {
      nextAttrs += ` style="${responsiveImgStyle}"`
    }
    return `<img${nextAttrs}>`
  })
}

function mapDetail(source: Record<string, unknown>): ProductDetail {
  const imagesRaw = source.images
  const detailImagesRaw = source.detailImages || source.detail_images
  const mayLikeRaw = source.mayLike || source.may_like
  let images: string[] = []
  if (Array.isArray(imagesRaw)) images = imagesRaw.map((item) => String(item || '')).filter(Boolean)
  if (!images.length && Array.isArray(detailImagesRaw)) {
    images = detailImagesRaw.map((item) => String(item || '')).filter(Boolean)
  }
  if (!images.length && source.cover) images = [String(source.cover)]
  let mayLike: { id: string; name: string; price: string; img: string }[] = []
  if (Array.isArray(mayLikeRaw)) {
    mayLike = mayLikeRaw
      .map((item) => {
        const row = (item || {}) as Record<string, unknown>
        return {
          id: String(row.id || ''),
          name: String(row.name || row.title || ''),
          price: String(row.price || '0.00'),
          img: String(row.img || row.cover || ''),
        }
      })
      .filter((item) => !!item.id)
  }
  let tags: string[] = []
  if (Array.isArray(source.tags)) {
    tags = (source.tags as unknown[]).map((item) => String(item || '')).filter(Boolean)
  } else if (source.tags) {
    tags = String(source.tags)
      .replace(/，/g, ',')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const specRows = normalizeSpecRows(source.specRows || source.spec_rows)
  const skuRows = normalizeSkuRows(source.skuRows || source.sku_rows)
  const skuPriceNums = skuRows.map((item) => parsePriceNum(item.price))
  const skuOriginNums = skuRows.map((item) => parsePriceNum(item.originPrice))
  const priceMin = skuPriceNums.length ? Math.min(...skuPriceNums) : parsePriceNum(source.price)
  const priceMax = skuPriceNums.length ? Math.max(...skuPriceNums) : parsePriceNum(source.price)
  const originPriceMin = skuOriginNums.length ? Math.min(...skuOriginNums) : parsePriceNum(source.originPrice || source.origin_price)
  const originPriceMax = skuOriginNums.length ? Math.max(...skuOriginNums) : parsePriceNum(source.originPrice || source.origin_price)
  const serviceRows = normalizeServiceRows(source.serviceRows || source.service_rows)
  const deliveryOptions = normalizeDeliveryOptions(source.deliveryOptions || source.delivery_options)
  const deliveryDesc = String(source.deliveryDesc || source.delivery_desc || '').trim()
  const shippingFee = parseMoney(source.shippingFee || source.shipping_fee || 0)
  const reviewRateNum = Number(source.reviewRate || source.review_rate || 98)
  const favorRaw = (source as Record<string, unknown>).isFavorited
  const favorRaw2 = (source as Record<string, unknown>).is_favorited
  const isFavorited = !!(favorRaw || favorRaw2)
  const reviewListRaw = source.reviewList || source.review_list
  const reviewList = Array.isArray(reviewListRaw)
    ? reviewListRaw
        .map((item) => {
          const row = (item || {}) as Record<string, unknown>
          const imagesRaw = row.images
          const images = Array.isArray(imagesRaw)
            ? imagesRaw.map((img) => String(img || '')).filter(Boolean)
            : []
          return {
            id: String(row.id || ''),
            score: Math.max(1, Math.min(5, Number(row.score || 5) || 5)),
            content: String(row.content || ''),
            images,
            nickname: String(row.nickname || '农场用户'),
            avatar: String(row.avatar || ''),
            createTime: String(row.createTime || row.create_time || ''),
          }
        })
        .filter((item) => !!item.id)
    : []
  return {
    id: String(source.id || ''),
    name: String(source.title || source.name || ''),
    price: parseMoney(priceMin),
    originPrice: parseMoney(originPriceMax),
    priceMin: parseMoney(priceMin),
    priceMax: parseMoney(priceMax),
    originPriceMin: parseMoney(originPriceMin),
    originPriceMax: parseMoney(originPriceMax),
    tags,
    intro: String(source.intro || source.subtitle || ''),
    images,
    detailHtml: normalizeDetailHtml(String(source.detailHtml || source.detail_html || '')),
    mayLike,
    specRows,
    skuRows,
    deliveryOptions,
    deliveryDesc,
    shippingFee,
    serviceRows,
    monthlySales: String(source.monthlySales || source.monthly_sales || '0'),
    reviewCount: String(source.reviewCount || source.review_count || '0'),
    reviewRate: `${Number.isNaN(reviewRateNum) ? 98 : reviewRateNum}%`,
    isFavorited,
    reviewList,
  }
}

function enableShareMenu() {
  try {
    ;(wx as any).showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  } catch (_) {
    // ignore
  }
}

Page({
  data: {
    detail: DEFAULT_DETAIL as ProductDetail,
    notFound: false,
    galleryIndex: 0,
    isFavorited: false,
    savePrice: '0.00',
    discountText: '10.0',
    monthlySales: '0',
    reviewCount: '0',
    reviewRate: '98%',
    specRows: [] as DetailSpecRow[],
    services: [] as string[],
    detailHtmlNodes: '',
    selectedSkuIndex: -1,
    selectedSkuText: '',
    selectedDeliveryValue: '',
    selectedDeliveryLabel: '',
    displayPrice: '0.00',
    displayOriginPrice: '0.00',
    deliveryDesc: '',
    showSpecPopup: false,
    specAction: 'select',
    buyCount: 1,
    specPopupTitle: '选择规格',
  },
  async onLoad(query: Record<string, string | undefined>) {
    enableShareMenu()
    const id = query.id || ''
    if (!id) {
      this.setupPage(DEFAULT_DETAIL, true)
      return
    }
    wx.showLoading({ title: '加载中', mask: true })
    try {
      const resp = (await getMallProductDetail(id, true)) as Record<string, unknown>
      if (Number(resp.code) !== 200 || !resp.data || typeof resp.data !== 'object') {
        this.setupPage(DEFAULT_DETAIL, true)
      } else {
        this.setupPage(mapDetail(resp.data as Record<string, unknown>), false)
      }
    } catch (_) {
      this.setupPage(DEFAULT_DETAIL, true)
    } finally {
      wx.hideLoading()
    }
  },
  onShareAppMessage() {
    const detail = this.data.detail || DEFAULT_DETAIL
    const title = detail.name ? `刚看到${detail.name}，像是从农场刚带回来的` : '这份农场好物，有点想带回家'
    const path = detail.id ? `/pages/product-detail/product-detail?id=${encodeURIComponent(detail.id)}` : '/pages/mall/mall'
    const imageUrl = detail.images && detail.images.length ? detail.images[0] : '/images/ad.jpg'
    return { title, path, imageUrl }
  },
  onShareTimeline() {
    const detail = this.data.detail || DEFAULT_DETAIL
    const title = detail.name ? `刚看到${detail.name}，像是从农场刚带回来的` : '这份农场好物，有点想带回家'
    const query = detail.id ? `id=${encodeURIComponent(detail.id)}` : ''
    const imageUrl = detail.images && detail.images.length ? detail.images[0] : '/images/ad.jpg'
    return { title, query, imageUrl }
  },
  setupPage(detail: ProductDetail, notFound: boolean) {
    const skuRows = Array.isArray(detail.skuRows) ? detail.skuRows : []
    let selectedSkuIndex = -1
    if (skuRows.length) {
      let minPrice = Number.POSITIVE_INFINITY
      skuRows.forEach((item, index) => {
        const price = parsePriceNum(item.price)
        if (price < minPrice) {
          minPrice = price
          selectedSkuIndex = index
        }
      })
    }
    const selectedSku = selectedSkuIndex >= 0 ? skuRows[selectedSkuIndex] : null
    const displayPrice = selectedSku ? selectedSku.price : detail.priceMin
    const displayOriginPrice = selectedSku ? selectedSku.originPrice : detail.originPriceMax
    const discountBasePrice = selectedSku ? parsePriceNum(selectedSku.price) : parsePriceNum(detail.priceMin)
    const discountBaseOrigin = selectedSku ? parsePriceNum(selectedSku.originPrice) : parsePriceNum(detail.originPriceMax)
    const save = Math.max(discountBaseOrigin - discountBasePrice, 0)
    const discount = discountBaseOrigin > 0 ? (discountBasePrice / discountBaseOrigin) * 10 : 10
    const deliveryOptions = detail.deliveryOptions || []
    const selectedDelivery = deliveryOptions.length ? deliveryOptions[0] : null
    this.setData({
      detail,
      notFound,
      galleryIndex: 0,
      isFavorited: !!detail.isFavorited,
      savePrice: save.toFixed(2),
      discountText: discount.toFixed(1),
      monthlySales: detail.monthlySales,
      reviewCount: detail.reviewCount,
      reviewRate: detail.reviewRate,
      specRows: detail.specRows,
      services: detail.serviceRows,
      detailHtmlNodes: detail.detailHtml || '',
      selectedSkuIndex,
      selectedSkuText: selectedSku ? `${selectedSku.name} \u00b7 1\u4ef6` : '',
      selectedDeliveryValue: selectedDelivery ? selectedDelivery.value : '',
      selectedDeliveryLabel: selectedDelivery ? selectedDelivery.label : '',
      displayPrice,
      displayOriginPrice,
      deliveryDesc: detail.deliveryDesc,
      showSpecPopup: false,
      specAction: 'select',
      buyCount: 1,
      specPopupTitle: '选择规格',
    })
  },
  applySku(index: number) {
    const list = this.data.detail.skuRows || []
    if (index < 0 || index >= list.length) return
    const sku = list[index]
    const price = parsePriceNum(sku.price)
    const origin = parsePriceNum(sku.originPrice)
    const save = Math.max(origin - price, 0)
    const discount = origin > 0 ? (price / origin) * 10 : 10
    this.setData({
      selectedSkuIndex: index,
      selectedSkuText: `${sku.name} \u00b7 ${this.data.buyCount || 1}\u4ef6`,
      displayPrice: parseMoney(sku.price),
      displayOriginPrice: parseMoney(sku.originPrice),
      savePrice: save.toFixed(2),
      discountText: discount.toFixed(1),
    })
  },
  openSpecPopup(action: 'select' | 'cart' | 'buy') {
    const list = this.data.detail.skuRows || []
    if (!list.length && action === 'select') {
      wx.showToast({ title: '当前商品暂无可选规格', icon: 'none' })
      return
    }
    const deliveryOptions = this.data.detail.deliveryOptions || []
    const nextDeliveryValue = this.data.selectedDeliveryValue || (deliveryOptions[0] ? deliveryOptions[0].value : '')
    const nextDeliveryLabel = this.data.selectedDeliveryLabel || (deliveryOptions[0] ? deliveryOptions[0].label : '')
    this.setData({
      showSpecPopup: true,
      specAction: action,
      specPopupTitle: action === 'buy' ? '立即购买' : action === 'cart' ? '加入购物车' : '选择规格',
      selectedDeliveryValue: nextDeliveryValue,
      selectedDeliveryLabel: nextDeliveryLabel,
    })
  },
  closeSpecPopup() {
    this.setData({ showSpecPopup: false })
  },
  onMaskTap() {
    this.closeSpecPopup()
  },
  onSpecPanelTap() {},
  onSkuTap(e: WechatMiniprogram.TouchEvent) {
    const index = Number((e.currentTarget.dataset as { index?: number }).index)
    if (Number.isNaN(index)) return
    this.applySku(index)
  },
  onDeliveryOptionTap(e: WechatMiniprogram.TouchEvent) {
    const value = String((e.currentTarget.dataset as { value?: string }).value || '')
    if (!value) return
    const list = this.data.detail.deliveryOptions || []
    const hit = list.find((item) => item.value === value)
    if (!hit) return
    this.setData({
      selectedDeliveryValue: hit.value,
      selectedDeliveryLabel: hit.label,
    })
  },
  onCountMinus() {
    const next = Math.max((this.data.buyCount || 1) - 1, 1)
    this.updateBuyCount(next)
  },
  onCountPlus() {
    const selected = this.getSelectedSku()
    const stock = selected ? selected.stock : 0
    const max = stock > 0 ? stock : 999
    const next = Math.min((this.data.buyCount || 1) + 1, max)
    this.updateBuyCount(next)
  },
  onCountInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const value = Number(e.detail.value || 1)
    const selected = this.getSelectedSku()
    const stock = selected ? selected.stock : 0
    const max = stock > 0 ? stock : 999
    const next = Math.min(Math.max(Number.isNaN(value) ? 1 : Math.floor(value), 1), max)
    this.updateBuyCount(next)
  },
  getSelectedSku() {
    const list = this.data.detail.skuRows || []
    const idx = this.data.selectedSkuIndex
    if (idx < 0 || idx >= list.length) return null
    return list[idx]
  },
  updateBuyCount(count: number) {
    const selected = this.getSelectedSku()
    this.setData({
      buyCount: count,
      selectedSkuText: selected ? `${selected.name} \u00b7 ${count}\u4ef6` : '',
    })
  },
  async onSpecConfirm() {
    const action = this.data.specAction
    const text = this.data.selectedSkuText
    const hasSkuRows = (this.data.detail.skuRows || []).length > 0
    const selected = this.getSelectedSku()
    if (hasSkuRows && !selected) {
      wx.showToast({ title: '请选择规格', icon: 'none' })
      return
    }
    if (action === 'cart') {
      const detail = this.data.detail
      const count = Math.max(1, Number(this.data.buyCount) || 1)
      const deliveryMode = String(this.data.selectedDeliveryLabel || this.data.selectedDeliveryValue || '')
      if ((this.data.detail.deliveryOptions || []).length && !deliveryMode) {
        wx.showToast({ title: '请选择配送方式', icon: 'none' })
        return
      }
      try {
        wx.showLoading({ title: '加入中', mask: true })
        if (!hasMiniLogin()) {
          await ensureMiniLogin()
        }
        const resp = (await addCartItem({
          productId: detail.id,
          skuName: selected ? selected.name : '',
          title: detail.name,
          img: detail.images && detail.images.length ? detail.images[0] : '',
          price: selected ? selected.price : detail.price,
          originPrice: selected ? selected.originPrice : detail.originPrice,
          quantity: count,
          deliveryMode,
          shippingFee: deliveryMode === '快递到家' ? String(detail.shippingFee || '0.00') : '0.00',
        })) as Record<string, unknown>
        if (Number(resp.code) !== 200) {
          wx.showToast({ title: String(resp.msg || '加入购物车失败'), icon: 'none' })
          return
        }
        this.closeSpecPopup()
        wx.showToast({ title: '已加入购物车', icon: 'success', duration: 2200 })
      } catch (_) {
        wx.showToast({ title: '加入购物车失败，请重试', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
      return
    }
    this.closeSpecPopup()
    if (action === 'buy') {
      const detail = this.data.detail
      const deliveryMode = String(this.data.selectedDeliveryLabel || this.data.selectedDeliveryValue || '')
      if ((this.data.detail.deliveryOptions || []).length && !deliveryMode) {
        wx.showToast({ title: '请选择配送方式', icon: 'none' })
        return
      }
      setBuyNowDraft({
        productId: String(detail.id || ''),
        skuName: selected ? selected.name : '',
        title: detail.name,
        img: detail.images && detail.images.length ? detail.images[0] : '',
        price: selected ? selected.price : detail.price,
        originPrice: selected ? selected.originPrice : detail.originPrice,
        quantity: Math.max(1, Number(this.data.buyCount) || 1),
        deliveryMode,
        shippingFee: String(detail.shippingFee || '0.00'),
      })
      wx.navigateTo({ url: '/pages/order-submit/order-submit' })
      return
    }
    wx.showToast({ title: `已选择：${text}`, icon: 'none' })
  },
  onGalleryChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ galleryIndex: e.detail.current })
  },
  onLikeTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },
  onCouponTap() {
    wx.navigateTo({ url: '/pages/coupon-center/coupon-center?scene=mall' })
  },
  onSpecTap() {
    this.openSpecPopup('select')
  },
  onDeliveryTap() {
    wx.showToast({ title: this.data.deliveryDesc || '配送说明待完善', icon: 'none' })
  },
  onMoreReviewsTap() {
    const detail = this.data.detail as ProductDetail
    const productId = String((detail && detail.id) || '')
    if (!productId) return
    wx.navigateTo({
      url: `/pages/product-review-list/product-review-list?id=${encodeURIComponent(productId)}&title=${encodeURIComponent(detail.name || '')}`,
    })
  },
  onPreviewReviewImageTap(e: WechatMiniprogram.TouchEvent) {
    const dataset = (e.currentTarget && e.currentTarget.dataset) || {}
    const reviewIndex = Number((dataset as Record<string, unknown>).reviewIndex || -1)
    const imageIndex = Number((dataset as Record<string, unknown>).imageIndex || 0)
    const reviewList = (this.data.detail && this.data.detail.reviewList) || []
    const review = reviewList[reviewIndex]
    const images = review && Array.isArray(review.images) ? review.images : []
    const current = images[imageIndex] || ''
    if (!current) return
    wx.previewImage({
      current,
      urls: images.length ? images : [current],
    })
  },
  async onFavoriteTap() {
    const productId = this.data.detail.id
    if (!productId) return
    try {
      if (!hasMiniLogin()) {
        wx.showLoading({ title: '登录中', mask: true })
        await ensureMiniLogin()
        wx.hideLoading()
      }
      wx.showLoading({ title: '处理中', mask: true })
      let resp = (await toggleProductFavorite(productId)) as Record<string, unknown>
      let code = Number(resp.code)
      let msg = String(resp.msg || '')
      if (code !== 200 && (code === 401 || msg.includes('用户不存在') || msg.includes('登录'))) {
        clearMiniAuth()
        await ensureMiniLogin()
        resp = (await toggleProductFavorite(productId)) as Record<string, unknown>
        code = Number(resp.code)
        msg = String(resp.msg || '')
      }
      if (code !== 200) {
        wx.hideLoading()
        wx.showToast({ title: msg || '操作失败，请重试', icon: 'none', duration: 2000 })
        return
      }
      const payload = (resp.data || {}) as Record<string, unknown>
      const next = !!(payload.isFavorited || payload.is_favorited)
      this.setData({ isFavorited: next })
      wx.hideLoading()
      wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'success', duration: 2000 })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败，请重试', icon: 'none', duration: 2000 })
    }
  },
  onAddCartTap() {
    this.openSpecPopup('cart')
  },
  onBuyTap() {
    this.openSpecPopup('buy')
  },
})
