import { addCartItem, ensureMiniLogin, getMallCategories, getMallProducts, hasMiniLogin } from '../../utils/api'

interface MallCategory {
  id: string
  name: string
}

interface MallFilterTag {
  id: string
  label: string
}

interface MallSkuRow {
  name: string
  price: string
  originPrice: string
  stock: number
}

interface MallDeliveryOption {
  value: string
  label: string
}

interface MallProduct {
  id: string
  categoryId: string
  title: string
  tags: string[]
  price: string
  originPrice: string
  img: string
  isNew?: boolean
  isHot?: boolean
  isRecommend?: boolean
  skuRows: MallSkuRow[]
  deliveryOptions: MallDeliveryOption[]
  shippingFee: string
}

function toMoney(value: unknown): number {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return 0
  return num
}

function toMoneyText(value: number): string {
  return value.toFixed(2)
}

const FILTER_TAGS: MallFilterTag[] = [
  { id: 'recommend', label: '推荐' },
  { id: 'hot', label: '热销' },
  { id: 'new', label: '新品' },
  { id: 'all', label: '全部' },
]

function toCategory(item: Record<string, unknown>): MallCategory {
  return {
    id: String(item.id || ''),
    name: String(item.name || ''),
  }
}

function toSkuRows(value: unknown): MallSkuRow[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const item = row as Record<string, unknown>
      return {
        name: String(item.name || '').trim(),
        price: toMoneyText(toMoney(item.price)),
        originPrice: toMoneyText(toMoney(item.originPrice || item.origin_price || item.price)),
        stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
      }
    })
    .filter((row) => !!row.name)
}

function toDeliveryOptions(value: unknown): MallDeliveryOption[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const item = row as Record<string, unknown>
      const valueText = String(item.value || item.label || '').trim()
      const labelText = String(item.label || valueText).trim()
      return { value: valueText, label: labelText }
    })
    .filter((row) => !!row.value && !!row.label)
}

function pickDefaultSku(product: MallProduct): MallSkuRow {
  const rows = product.skuRows || []
  if (!rows.length) {
    return { name: '默认规格', price: product.price, originPrice: product.originPrice || product.price, stock: 0 }
  }
  const available = rows.filter((row) => row.stock > 0)
  const candidates = available.length ? available : rows
  return candidates.slice().sort((a, b) => toMoney(a.price) - toMoney(b.price))[0]
}

function toProduct(item: Record<string, unknown>): MallProduct {
  const rawTags = item.tags
  let tags: string[] = []
  if (Array.isArray(rawTags)) {
    tags = rawTags.map((tag) => String(tag || '')).filter(Boolean)
  } else if (rawTags !== undefined && rawTags !== null) {
    tags = String(rawTags)
      .replace(/\uFF0C/g, ',')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  const skuRows = toSkuRows(item.skuRows || item.sku_rows)
  const skuPrices = skuRows
    .map((row) => toMoney(row.price))
    .filter((price) => price > 0)
  const price = skuPrices.length ? Math.min(...skuPrices) : toMoney(item.price)
  const originCandidate = skuRows
    .map((row) => toMoney(row.originPrice || row.price))
    .filter((value) => value > 0)
  const originPrice = originCandidate.length ? Math.max(...originCandidate) : toMoney(item.originPrice || item.origin_price)
  return {
    id: String(item.id || ''),
    categoryId: String(item.categoryId || item.category_id || ''),
    title: String(item.title || ''),
    tags,
    price: toMoneyText(price),
    originPrice: originPrice > price ? toMoneyText(originPrice) : '',
    img: String(item.cover || item.img || ''),
    isNew: !!(item.isNew || item.is_new),
    isHot: !!(item.isHot || item.is_hot),
    isRecommend: !!(item.isRecommend || item.is_recommend),
    skuRows,
    deliveryOptions: toDeliveryOptions(item.deliveryOptions || item.delivery_options),
    shippingFee: toMoneyText(toMoney(item.shippingFee || item.shipping_fee || 0)),
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
    searchKeyword: '',
    searchFocused: false,
    filterTags: FILTER_TAGS,
    activeFilterTagId: 'all',
    categories: [] as MallCategory[],
    activeCategoryId: '',
    activeCategoryName: '推荐',
    allProducts: [] as MallProduct[],
    displayProducts: [] as MallProduct[],
    _lastMallTabTapAt: 0,
  },

  async onLoad() {
    enableShareMenu()
    await this.loadData(true)
  },

  onShareAppMessage() {
    const list = this.data.displayProducts && this.data.displayProducts.length ? this.data.displayProducts : this.data.allProducts
    const first = list && list.length ? list[0] : null
    return {
      title: `${this.data.activeCategoryName || '农场商城'}好物上新，今天想带点农场味回家`,
      path: '/pages/mall/mall',
      imageUrl: (first && first.img) || '/images/ad.jpg',
    }
  },

  onShareTimeline() {
    const list = this.data.displayProducts && this.data.displayProducts.length ? this.data.displayProducts : this.data.allProducts
    const first = list && list.length ? list[0] : null
    return {
      title: `${this.data.activeCategoryName || '农场商城'}好物上新，今天想带点农场味回家`,
      query: '',
      imageUrl: (first && first.img) || '/images/ad.jpg',
    }
  },

  onShow() {
    this.applyPreferredFilterTag()
  },

  async loadData(showLoading = false) {
    if (showLoading) wx.showLoading({ title: '加载中', mask: true })
    try {
      const [categoryResp, productResp] = await Promise.all([getMallCategories(), getMallProducts()])
      const categoryRows = Array.isArray((categoryResp as Record<string, unknown>).data)
        ? ((categoryResp as Record<string, unknown>).data as Record<string, unknown>[])
        : []
      const productRows = Array.isArray((productResp as Record<string, unknown>).data)
        ? ((productResp as Record<string, unknown>).data as Record<string, unknown>[])
        : []

      const categories = categoryRows.map(toCategory).filter((item) => !!item.id)
      const products = productRows.map(toProduct).filter((item) => !!item.id)

      let activeCategoryId = this.data.activeCategoryId
      if (!activeCategoryId || !categories.some((item) => item.id === activeCategoryId)) {
        activeCategoryId = categories.length > 0 ? categories[0].id : ''
      }
      const activeHit = categories.find((item) => item.id === activeCategoryId)
      const activeCategoryName = activeHit ? activeHit.name : '推荐'

      this.setData({
        categories,
        allProducts: products,
        activeCategoryId,
        activeCategoryName,
      })
      this.applyFilters()
      this.applyPreferredFilterTag()
    } catch (error) {
      console.warn('mall load error:', error)
      wx.showToast({ title: '商城加载失败', icon: 'none' })
    } finally {
      if (showLoading) wx.hideLoading()
    }
  },

  async refreshMallByAction(action: 'pull' | 'doubleTap') {
    await this.loadData(false)
    if (action === 'pull') {
      wx.stopPullDownRefresh()
    }
  },

  onPullDownRefresh() {
    this.refreshMallByAction('pull')
  },

  onTabItemTap(item: { index: number; pagePath: string; text: string }) {
    if (!item || item.pagePath !== 'pages/mall/mall') return
    const now = Date.now()
    const last = Number(this.data._lastMallTabTapAt || 0)
    this.setData({ _lastMallTabTapAt: now })
    if (last && now - last <= 350) {
      this.refreshMallByAction('doubleTap')
    }
  },

  applyPreferredFilterTag() {
    let tag = ''
    try {
      const app = getApp<{ globalData?: { mallPrefFilterTag?: string } }>()
      tag = String((app && app.globalData && app.globalData.mallPrefFilterTag) || '')
      if (tag && app && app.globalData) {
        app.globalData.mallPrefFilterTag = ''
      }
    } catch (_) {
      tag = ''
    }
    try {
      if (!tag) {
        tag = String(wx.getStorageSync('mall_pref_filter_tag') || '')
      }
      if (tag) {
        wx.removeStorageSync('mall_pref_filter_tag')
      }
    } catch (_) {
      // ignore storage errors
    }
    if (!tag) return
    const exists = (this.data.filterTags || []).some((item) => item.id === tag)
    if (!exists) return
    this.setData({ activeFilterTagId: tag })
    this.applyFilters()
  },

  applyFilters() {
    const kw = (this.data.searchKeyword || '').trim()
    const cat = this.data.activeCategoryId
    const tagId = this.data.activeFilterTagId
    const all = this.data.allProducts || []
    let list = all
    if (cat) {
      list = list.filter((p) => p.categoryId === cat)
    }
    if (tagId === 'new') list = list.filter((p) => !!p.isNew)
    if (tagId === 'hot') list = list.filter((p) => !!p.isHot)
    if (tagId === 'recommend') list = list.filter((p) => !!p.isRecommend)
    if (kw) {
      list = list.filter((p) => p.title.indexOf(kw) >= 0)
    }
    const hit = (this.data.categories || []).find((c) => c.id === cat)
    const activeCategoryName = hit ? hit.name : '推荐'
    this.setData({ displayProducts: list, activeCategoryName })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ searchKeyword: e.detail.value || '' })
    this.applyFilters()
  },

  onSearchFocus() {
    this.setData({ searchFocused: true })
  },

  onSearchBlur() {
    this.setData({ searchFocused: false })
  },

  onSearchConfirm() {
    const kw = (this.data.searchKeyword || '').trim()
    if (!kw) {
      wx.showToast({ title: '请输入商品关键词', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/search-result/search-result?keyword=${encodeURIComponent(kw)}` })
  },

  onFilterTagTap(e: WechatMiniprogram.TouchEvent) {
    const id = ((e.currentTarget.dataset as { id?: string }).id || 'all') as string
    if (id === this.data.activeFilterTagId) return
    this.setData({ activeFilterTagId: id })
    this.applyFilters()
  },

  onCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id as string
    if (!id || id === this.data.activeCategoryId) return
    this.setData({ activeCategoryId: id })
    this.applyFilters()
  },

  onProductTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id as string
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },

  async onAddCart(e: WechatMiniprogram.TouchEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    const product = (this.data.allProducts || []).find((item) => item.id === id)
    if (!product) {
      wx.showToast({ title: '商品不存在', icon: 'none' })
      return
    }
    const sku = pickDefaultSku(product)
    const delivery = product.deliveryOptions && product.deliveryOptions.length ? product.deliveryOptions[0] : null
    try {
      wx.showLoading({ title: '加入中', mask: true })
      if (!hasMiniLogin()) {
        await ensureMiniLogin()
      }
      const resp = (await addCartItem({
        productId: product.id,
        skuName: sku.name || '默认规格',
        title: product.title,
        img: product.img,
        price: sku.price || product.price,
        originPrice: sku.originPrice || product.originPrice || sku.price || product.price,
        quantity: 1,
        deliveryMode: delivery ? delivery.label : '',
        shippingFee: delivery && delivery.label === '快递到家' ? product.shippingFee : '0.00',
      })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '加入购物车失败'), icon: 'none' })
        return
      }
      wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 })
    } catch (_) {
      wx.showToast({ title: '加入购物车失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})
