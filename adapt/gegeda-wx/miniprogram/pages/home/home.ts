import { getAdoptProducts, getBaseInfo, getHomeBanners, getHomeNotices, getMallProducts } from '../../utils/api'

interface SlideItem {
  id: string
  img: string
  title: string
  jumpType?: string
  targetId?: string
  jumpUrl?: string
}

interface NoticeItem {
  id: string
  title?: string
  text: string
}

interface MenuPrimaryItem {
  id: string
  label: string
  icon: string
}

interface MenuSecondaryItem {
  id: string
  title: string
  sub: string
  icon: string
}

interface FlashGoodsItem {
  id: string
  name: string
  img: string
  flashPrice: string
  originPrice: string
}

interface AdoptRecItem {
  id: string
  name: string
  img: string
  tags: string[]
  price: string
  badge: string
}

interface FeatProdItem {
  id: string
  name: string
  img: string
  tags: string[]
  price: string
  badge: string
}

const TAG_DISPLAY_MAX = 2

function capTags<T extends { tags: string[] }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    tags: item.tags.slice(0, TAG_DISPLAY_MAX),
  }))
}

let flashCountdownId: ReturnType<typeof setInterval> | undefined

function pickFirst(data: Record<string, unknown>, keys: string[]) {
  for (let i = 0; i < keys.length; i++) {
    const v = data[keys[i]]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v)
    }
  }
  return ''
}

function pickBoolean(data: Record<string, unknown>, keys: string[], fallback = true) {
  for (let i = 0; i < keys.length; i++) {
    const v = data[keys[i]]
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'boolean') return v
    const text = String(v).trim().toLowerCase()
    if (text === '1' || text === 'true' || text === 'yes' || text === 'on') return true
    if (text === '0' || text === 'false' || text === 'no' || text === 'off') return false
  }
  return fallback
}

function pickTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || '').trim()).filter(Boolean)
  }
  const text = String(value || '').trim()
  if (!text) return []
  return text
    .replace(/，/g, ',')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function enableShareMenu() {
  try {
    ;(wx as any).showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  } catch (_) {
    // 分享菜单能力在低版本基础库中可能不可用，失败不影响页面使用。
  }
}

Page({
  data: {
    imgAd: '',
    sloganText: '',
    searchKeyword: '',
    searchFocused: false,
    slides: [] as SlideItem[],
    announcements: [] as NoticeItem[],
    noticeVisible: false,
    noticeModalTitle: '',
    noticeModalText: '',
    menuPrimary: [] as MenuPrimaryItem[],
    menuSecondary: [] as MenuSecondaryItem[],
    flashCountH: '00',
    flashCountM: '00',
    flashCountS: '00',
    flashCountCs: '00',
    flashItems: [] as FlashGoodsItem[],
    adoptRecItems: [] as AdoptRecItem[],
    featProdItems: [] as FeatProdItem[],
    farmVideoSrc: '',
    farmVideoPoster: '',
    adoptNoticeText: '',
    adoptNoticeTags: [] as { id: string; icon: string; label: string }[],
    todayReservationEnabled: true,
    reservationBadgeText: '今日可预约',
    reservationBadgeClass: '',
  },

  onLoad() {
    enableShareMenu()
    const menuPrimary: MenuPrimaryItem[] = [
      { id: 'adopt', label: '\u8ba4\u517b', icon: '/images/home/adopt.svg' },
      { id: 'mall', label: '\u5546\u57ce', icon: '/images/home/store.svg' },
      { id: 'order', label: '\u8ba2\u5355', icon: '/images/home/order-main.svg' },
      { id: 'monitor', label: '\u76d1\u63a7', icon: '/images/home/watch.svg' },
    ]
    const menuSecondary: MenuSecondaryItem[] = [
      { id: 'coupon', title: '\u6d3b\u52a8', sub: '\u9650\u65f6\u6d3b\u52a8', icon: '/images/home/activate.svg' },
      { id: 'service', title: '\u9884\u7ea6', sub: '\u519c\u573a\u4f53\u9a8c', icon: '/images/home/order.svg' },
    ]

    this.setData({
      menuPrimary,
      menuSecondary,
      slides: [],
      announcements: [],
      flashItems: [],
      adoptRecItems: [],
      featProdItems: [],
      adoptNoticeText: '',
      adoptNoticeTags: [],
    })

    this.refreshHomeData()
  },

  onShareAppMessage() {
    const slides = this.data.slides || []
    const imageUrl = (slides[0] && slides[0].img) || this.data.imgAd || '/images/ad.jpg'
    const title = this.data.sloganText ? `我发现一个农场：${this.data.sloganText}` : '今天去农场看看，顺便认养一只小伙伴'
    return {
      title,
      path: '/pages/home/home',
      imageUrl,
    }
  },

  onShareTimeline() {
    const slides = this.data.slides || []
    const imageUrl = (slides[0] && slides[0].img) || this.data.imgAd || '/images/ad.jpg'
    const title = this.data.sloganText ? `我发现一个农场：${this.data.sloganText}` : '今天去农场看看，顺便认养一只小伙伴'
    return {
      title,
      query: '',
      imageUrl,
    }
  },

  async refreshHomeData() {
    await Promise.all([
      this.loadBaseInfo(),
      this.loadHomeBanners(),
      this.loadHomeNotices(),
      this.loadAdoptRecItems(),
      this.loadFlashItems(),
      this.loadFeaturedItems(),
    ])
  },

  async onPullDownRefresh() {
    try {
      await this.refreshHomeData()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async loadAdoptRecItems() {
    try {
      const resp = (await getAdoptProducts('all', { tag: '认养推荐', limit: 4 })) as Record<string, unknown>
      const source = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (source && source.data) || source
      const list = Array.isArray(listData) ? listData : []
      const adoptRecItems: AdoptRecItem[] = []
      for (let i = 0; i < list.length && adoptRecItems.length < 4; i++) {
        const item = list[i] as Record<string, unknown>
        const id = pickFirst(item, ['id']) || `adopt-rec-${i + 1}`
        const name = pickFirst(item, ['title', 'name'])
        const img = pickFirst(item, ['cover', 'img', 'image'])
        const price = pickFirst(item, ['price']) || '0.00'
        const tags = pickTags(item.tags)
        if (!name) continue
        adoptRecItems.push({
          id,
          name,
          img,
          tags,
          price: `¥${price}`,
          badge: tags[0] || '认养推荐',
        })
      }
      this.setData({ adoptRecItems: capTags(adoptRecItems) })
    } catch (error) {
      console.warn('加载认养推荐失败:', error)
      this.setData({ adoptRecItems: [] })
    }
  },

  async loadFlashItems() {
    try {
      const resp = (await getMallProducts({ tag: 'flash' })) as Record<string, unknown>
      const source = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (source && source.data) || source
      const list = Array.isArray(listData) ? listData : []
      const flashItems: FlashGoodsItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const id = pickFirst(item, ['id']) || `flash-${i + 1}`
        const name = pickFirst(item, ['title', 'name'])
        const img = pickFirst(item, ['cover', 'img', 'image'])
        const flashPrice = pickFirst(item, ['price', 'flashPrice', 'flash_price']) || '0.00'
        const originPrice = pickFirst(item, ['originPrice', 'origin_price']) || flashPrice
        if (!name) continue
        flashItems.push({ id, name, img, flashPrice, originPrice })
      }
      this.setData({ flashItems })
    } catch (error) {
      console.warn('loadFlashItems failed:', error)
      this.setData({ flashItems: [] })
    }
  },

  async loadFeaturedItems() {
    try {
      const resp = (await getMallProducts({ tag: 'hot' })) as Record<string, unknown>
      const source = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (source && source.data) || source
      const list = Array.isArray(listData) ? listData : []
      const featProdItems: FeatProdItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const id = pickFirst(item, ['id']) || `hot-${i + 1}`
        const name = pickFirst(item, ['title', 'name'])
        const img = pickFirst(item, ['cover', 'img', 'image'])
        const price = pickFirst(item, ['price']) || '0.00'
        const tags = pickTags(item.tags)
        if (!name) continue
        featProdItems.push({ id, name, img, tags, price: `¥${price}`, badge: '热销爆款' })
      }
      this.setData({ featProdItems: capTags(featProdItems).slice(0, 6) })
    } catch (error) {
      console.warn('loadFeaturedItems failed:', error)
      this.setData({ featProdItems: [] })
    }
  },

  async loadBaseInfo() {
    try {
      const resp = (await getBaseInfo()) as Record<string, unknown>
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const base = ((source && source.data) || source) as Record<string, unknown>

      const logo = pickFirst(base, ['logo', 'logoUrl', 'logo_url'])
      const slogan = pickFirst(base, ['slogan', 'siteSlogan', 'subtitle'])
      const farmVideo = pickFirst(base, ['farmVideo', 'farm_video', 'video'])
      const adoptNotice = pickFirst(base, ['adoptNotice', 'adopt_notice', 'notice'])
      const todayReservationEnabled = pickBoolean(base, ['todayReservationEnabled', 'today_reservation_enabled'], true)

      const patch: Record<string, string | boolean> = {
        todayReservationEnabled,
        reservationBadgeText: todayReservationEnabled ? '今日可预约' : '今日不预约',
        reservationBadgeClass: todayReservationEnabled ? '' : 'menu-head-badge--closed',
      }
      if (logo) patch.imgAd = logo
      if (logo && /^https?:\/\//.test(logo)) patch.farmVideoPoster = logo
      if (slogan) patch.sloganText = slogan
      if (farmVideo) patch.farmVideoSrc = farmVideo
      if (adoptNotice) patch.adoptNoticeText = adoptNotice
      this.setData(patch)
    } catch (error) {
      console.warn('loadBaseInfo failed:', error)
    }
  },

  async loadHomeBanners() {
    try {
      const resp = (await getHomeBanners()) as Record<string, unknown>
      const source = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (source && source.data) || source
      const list = Array.isArray(listData) ? listData : []

      const slides: SlideItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const image = pickFirst(item, ['image', 'img', 'cover'])
        if (!image) continue
        const title = pickFirst(item, ['title', 'name'])
        const id = pickFirst(item, ['id']) || `api-${i + 1}`
        slides.push({
          id,
          img: image,
          title,
          jumpType: pickFirst(item, ['jumpType', 'jump_type']) || 'none',
          targetId: pickFirst(item, ['targetId', 'target_id']),
          jumpUrl: pickFirst(item, ['jumpUrl', 'jump_url']),
        })
      }

      this.setData({ slides })
    } catch (error) {
      console.warn('loadHomeBanners failed:', error)
      this.setData({ slides: [] })
    }
  },

  async loadHomeNotices() {
    try {
      const resp = (await getHomeNotices()) as Record<string, unknown>
      const source = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (source && source.data) || source
      const list = Array.isArray(listData) ? listData : []

      const announcements: NoticeItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const title = pickFirst(item, ['title', 'name'])
        const text = pickFirst(item, ['content', 'text', 'notice'])
        if (!text) continue
        const id = pickFirst(item, ['id']) || `notice-${i + 1}`
        announcements.push({ id, title, text })
      }

      this.setData({ announcements })
    } catch (error) {
      console.warn('loadHomeNotices failed:', error)
      this.setData({ announcements: [] })
    }
  },

  onShow() {
    this.startFlashCountdown()
  },

  onHide() {
    this.clearFlashCountdown()
  },

  onUnload() {
    this.clearFlashCountdown()
  },

  startFlashCountdown() {
    this.clearFlashCountdown()
    const tick = () => {
      const now = Date.now()
      const end = new Date()
      end.setDate(end.getDate() + 1)
      end.setHours(0, 0, 0, 0)
      let diff = end.getTime() - now
      if (diff < 0) diff = 0
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      const cs = Math.floor((diff % 1000) / 10)
      const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
      this.setData({
        flashCountH: pad(h),
        flashCountM: pad(m),
        flashCountS: pad(s),
        flashCountCs: pad(cs),
      })
    }
    tick()
    flashCountdownId = setInterval(tick, 100)
  },

  clearFlashCountdown() {
    if (flashCountdownId) {
      clearInterval(flashCountdownId)
      flashCountdownId = undefined
    }
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchFocus() {
    this.setData({ searchFocused: true })
  },

  onSearchBlur() {
    this.setData({ searchFocused: false })
  },

  onSearchConfirm(e: WechatMiniprogram.Input) {
    const v = (e.detail.value || '').trim()
    if (!v) {
      wx.showToast({ title: '请输入商品关键词', icon: 'none' })
      return
    }
    this.setData({ searchKeyword: v })
    wx.navigateTo({ url: `/pages/search-result/search-result?keyword=${encodeURIComponent(v)}` })
  },

  onBannerTap(e: WechatMiniprogram.TouchEvent) {
    const dataset = e.currentTarget.dataset as Record<string, unknown>
    const id = String(dataset.id || '')
    if (!id) return
    const slides = this.data.slides || []
    let current: SlideItem | null = null
    for (let i = 0; i < slides.length; i++) {
      if (String(slides[i].id) === id) {
        current = slides[i]
        break
      }
    }
    if (!current) return

    const jumpType = String(current.jumpType || 'none')
    const targetId = String(current.targetId || '')
    const jumpUrl = String(current.jumpUrl || '')

    if (jumpType === 'product' && targetId) {
      wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${encodeURIComponent(targetId)}` })
      return
    }
    if (jumpType === 'activity' && targetId) {
      wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${encodeURIComponent(targetId)}` })
      return
    }
    if (jumpUrl) {
      wx.navigateTo({ url: jumpUrl })
    }
  },

  onNoticeTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    const list = this.data.announcements as NoticeItem[]
    let title = '公告详情'
    let text = ''
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        text = list[i].text
        if (list[i].title) title = String(list[i].title)
        break
      }
    }
    if (!text) return
    this.setData({ noticeVisible: true, noticeModalTitle: title, noticeModalText: text })
  },

  onNoticeClose() {
    this.setData({ noticeVisible: false })
  },

  noop() {},

  onMenuShortcutTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    if (id === 'adopt') {
      wx.switchTab({ url: '/pages/adopt/adopt' })
      return
    }
    if (id === 'mall') {
      wx.switchTab({ url: '/pages/mall/mall' })
      return
    }
    if (id === 'monitor') {
      wx.navigateTo({ url: '/pages/monitor/monitor' })
      return
    }
    if (id === 'order') {
      wx.navigateTo({ url: '/pages/order-list/order-list?tab=all' })
      return
    }
    if (id === 'coupon') {
      wx.navigateTo({ url: '/pages/event/event' })
      return
    }
    if (id === 'service') {
      wx.navigateTo({ url: '/pages/reserve/reserve' })
    }
  },

  onFlashBuyTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },

  onAdoptRecMoreTap() {
    wx.switchTab({ url: '/pages/adopt/adopt' })
  },

  onAdoptRecBuyTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    wx.navigateTo({ url: `/pages/adopt-detail/adopt-detail?id=${id}` })
  },

  onFeatProdMoreTap() {
    try {
      const app = getApp<{ globalData?: { mallPrefFilterTag?: string } }>()
      if (app && app.globalData) {
        app.globalData.mallPrefFilterTag = 'hot'
      }
    } catch (_) {
      // ignore
    }
    try {
      wx.setStorageSync('mall_pref_filter_tag', 'hot')
    } catch (_) {
      // ignore
    }
    wx.switchTab({ url: '/pages/mall/mall' })
  },

  onFeatProdBuyTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },
})
