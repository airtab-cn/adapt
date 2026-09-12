import { getAdoptProductDetail, getBaseInfo } from '../../utils/api'

interface AdoptDetail {
  id: string
  name: string
  badge: string
  cover: string
  gallery: string[]
  price: string
  originPrice: string
  cycle: string
  adoptDays: number
  stockText: string
  subtitle: string
  tagList: string[]
  intro: string
  giftEggCount: number
  giftItemName: string
  giftItemUnit: string
  giftEggRule: string
  highlights: string[]
  serviceItems: string[]
  process: string[]
  tips: string[]
}

const DEFAULT_DETAIL: AdoptDetail = {
  id: '',
  name: '',
  badge: '',
  cover: '',
  gallery: [],
  price: '0.00',
  originPrice: '0.00',
  cycle: '',
  adoptDays: 0,
  stockText: '',
  subtitle: '',
  tagList: [],
  intro: '',
  giftEggCount: 0,
  giftItemName: '',
  giftItemUnit: '',
  giftEggRule: '',
  highlights: [],
  serviceItems: [],
  process: [],
  tips: [],
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function mergeLists(...args: string[][]): string[] {
  const result: string[] = []
  args.forEach((rows) => {
    rows.forEach((item) => {
      if (item && !result.includes(item)) result.push(item)
    })
  })
  return result
}

function mapDetail(data: Record<string, any>): AdoptDetail {
  const stockNum = Number(data.stock || 0)
  const gallery = Array.isArray(data.gallery) && data.gallery.length
    ? data.gallery.map((item) => String(item || '').trim()).filter(Boolean)
    : (Array.isArray(data.images) ? data.images.map((item) => String(item || '').trim()).filter(Boolean) : [])
  const cover = String(data.cover || data.img || '')
  const highlights = normalizeList(data.highlights)
  const serviceItems = mergeLists(normalizeList(data.serviceItems), normalizeList(data.service_items))
  const adoptDays = Number(data.adoptDays || data.adopt_days || 0)
  return {
    id: String(data.id || '0'),
    name: String(data.name || data.title || ''),
    badge: String(data.badge || data.tag || ''),
    cover,
    gallery: gallery.length ? gallery : (cover ? [cover] : []),
    price: String(data.price || '0.00'),
    originPrice: String(data.originPrice || data.origin_price || data.price || '0.00'),
    cycle: String(data.cycle || (adoptDays ? `\u8ba4\u517b\u5468\u671f \u00b7 ${adoptDays}\u5929` : '')),
    adoptDays,
    stockText: stockNum > 0 ? `\u5269\u4f59 ${stockNum} \u4ef6` : '',
    subtitle: String(data.subtitle || ''),
    tagList: normalizeList(data.tags),
    intro: String(data.intro || ''),
    giftEggCount: Number(data.giftEggCount || data.gift_egg_count || 0),
    giftItemName: String(data.giftItemName || data.gift_item_name || ''),
    giftItemUnit: String(data.giftItemUnit || data.gift_item_unit || ''),
    giftEggRule: String(data.giftEggRule || data.gift_egg_rule || ''),
    highlights,
    serviceItems,
    process: normalizeList(data.process),
    tips: normalizeList(data.tips),
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
    detail: DEFAULT_DETAIL,
    swiperCurrent: 0,
    notFound: false,
    agreementVisible: false,
    agreementTitle: '认养服务协议',
    agreementText: '',
    contactPhone: '',
  },

  async onLoad(query: Record<string, string | undefined>) {
    enableShareMenu()
    await this.loadAgreement()
    const id = query.id || ''
    if (!id) {
      this.setData({ detail: DEFAULT_DETAIL, notFound: true })
      return
    }
    try {
      const resp = (await getAdoptProductDetail(id)) as Record<string, any>
      if (Number(resp.code) !== 200 || !resp.data) {
        this.setData({ detail: DEFAULT_DETAIL, swiperCurrent: 0, notFound: true })
        return
      }
      this.setData({ detail: mapDetail(resp.data), swiperCurrent: 0, notFound: false })
    } catch (error) {
      console.error('getAdoptProductDetail error', error)
      this.setData({ detail: DEFAULT_DETAIL, swiperCurrent: 0, notFound: true })
    }
  },

  onShareAppMessage() {
    const detail = this.data.detail || DEFAULT_DETAIL
    const title = detail.name ? `${detail.name}正在农场等一个认养人` : '来农场认养一只小伙伴，把牵挂养在田野里'
    const path = detail.id ? `/pages/adopt-detail/adopt-detail?id=${encodeURIComponent(detail.id)}` : '/pages/adopt/adopt'
    const imageUrl = (detail.gallery && detail.gallery.length ? detail.gallery[0] : detail.cover) || '/images/adopt/adapt.svg'
    return { title, path, imageUrl }
  },

  onShareTimeline() {
    const detail = this.data.detail || DEFAULT_DETAIL
    const title = detail.name ? `${detail.name}正在农场等一个认养人` : '来农场认养一只小伙伴，把牵挂养在田野里'
    const query = detail.id ? `id=${encodeURIComponent(detail.id)}` : ''
    const imageUrl = (detail.gallery && detail.gallery.length ? detail.gallery[0] : detail.cover) || '/images/adopt/adapt.svg'
    return { title, query, imageUrl }
  },

  onHeroSwiperChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ swiperCurrent: Number(e.detail.current || 0) })
  },

  async loadAgreement() {
    try {
      const resp = (await getBaseInfo()) as Record<string, any>
      const data = (resp && resp.data) || {}
      const phone = String(data.phone || '').trim()
      const text = String(data.adoptAgreement || data.adopt_agreement || '')
      const patch: Record<string, unknown> = {}
      if (phone) patch.contactPhone = phone
      if (text) {
        patch.agreementText = text
        this.setData(patch)
        return
      }
      if (Object.keys(patch).length) this.setData(patch)
    } catch (error) {
      console.error('loadAgreement error', error)
    }
  },

  onAgreementTap() {
    this.setData({ agreementVisible: true })
  },

  onConsultTap() {
    const phone = String(this.data.contactPhone || '').replace(/-/g, '').trim()
    if (!phone) {
      wx.showToast({ title: '\u6682\u672a\u914d\u7f6e\u8054\u7cfb\u7535\u8bdd', icon: 'none' })
      return
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        wx.showToast({ title: '拨号失败，请稍后重试', icon: 'none' })
      },
    })
  },

  onAgreementClose() {
    this.setData({ agreementVisible: false })
  },

  onAdoptNowTap() {
    const id = String(this.data.detail.id || '0')
    if (!id || id === '0') {
      wx.showToast({ title: '当前认养商品无效', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/adopt-order-submit/adopt-order-submit?id=${id}` })
  },
})
