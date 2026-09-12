import {
  clearMiniAuth,
  ensureMiniLogin,
  getBalanceStats,
  getBaseInfo,
  getCouponStats,
  getPointStats,
  getMyAdoptArchive,
  getMallOrderList,
  getUserProfile,
  hasMiniLogin,
  MINI_PROFILE_KEY,
} from '../../utils/api'

interface UserProfile {
  avatar: string
  nickname: string
}

interface Assets {
  balance: string
  points: string
  adoptCount: string
  couponCount: string
}

interface ServiceEntry {
  id: string
  label: string
  icon: string
  danger?: boolean
}

interface OrderEntry {
  id: string
  status: string
  label: string
  icon: string
  badge: number
}

interface FarmInfo {
  cover: string
  name: string
  phone: string
  wechat: string
  address: string
  tag: string
  slogan: string
  latitude: number
  longitude: number
}

const DEFAULT_AVATAR = '/images/avatar.svg'
const STR_WELCOME = '欢迎回来'
const STR_GUEST = '陌生人'
const STR_DEFAULT_NICK = '小鸡饲养员'
const STR_LOGIN = '登录'

function getTimeGreetText() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return '早上好'
  if (hour >= 11 && hour < 18) return '中午好'
  return '晚上好'
}

function pickFirst(data: Record<string, unknown>, keys: string[]) {
  for (let i = 0; i < keys.length; i++) {
    const v = data[keys[i]]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return ''
}

function guestAssets(): Assets {
  return { balance: '-', points: '-', adoptCount: '-', couponCount: '-' }
}

function orderEntries(): OrderEntry[] {
  return [
    { id: 'unpaid', status: 'unpaid', label: '待付款', icon: '/images/order/待付款.svg', badge: 0 },
    { id: 'unshipped', status: 'unshipped', label: '待发货', icon: '/images/order/待发货.svg', badge: 0 },
    { id: 'unreceived', status: 'unreceived', label: '待收货', icon: '/images/order/待收货.svg', badge: 0 },
    { id: 'pending_review', status: 'pending_review', label: '待评价', icon: '/images/order/待评价.svg', badge: 0 },
    { id: 'done', status: 'completed', label: '已完成', icon: '/images/order/已完成.svg', badge: 0 },
  ]
}

function serviceEntries(loggedIn: boolean): ServiceEntry[] {
  const list: ServiceEntry[] = [
    { id: 'address', label: '我的地址', icon: '/images/order/收货地址.svg' },
    { id: 'favorite', label: '我的收藏', icon: '/images/order/我的收藏-b.svg' },
    { id: 'adopt_agreement', label: '认养协议', icon: '/images/order/认养协议.svg' },
    { id: 'activity', label: '农场活动', icon: '/images/order/活动.svg' },
    { id: 'service', label: '我的客服', icon: '/images/order/客服.svg' },
  ]
  if (loggedIn) {
    list.push({ id: 'logout', label: '退出登录', icon: '/images/order/退出登录.svg', danger: true })
  }
  return list
}

Page({
  data: {
    loggedIn: false,
    greetText: getTimeGreetText(),
    guestNameText: STR_GUEST,
    loginButtonText: STR_LOGIN,
    user: { avatar: DEFAULT_AVATAR, nickname: STR_GUEST } as UserProfile,
    assets: guestAssets() as Assets,
    orderEntries: orderEntries() as OrderEntry[],
    serviceEntries: serviceEntries(false) as ServiceEntry[],
    farm: {
      cover: '/images/ad.jpg',
      name: '绿叶生态农场',
      phone: '400-888-6688',
      wechat: 'gegeda-service',
      address: '浙江省杭州市余杭区绿色生态示范园 A 区 18 号',
      tag: '溯源基地',
      slogan: '生态养殖 · 新鲜直达',
      latitude: 30.4212,
      longitude: 119.9776,
    } as FarmInfo,
  },

  onShow() {
    this.loadBaseInfo()
    this.refreshAuthState()
  },

  async onPullDownRefresh() {
    try {
      await this.refreshMineData()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async refreshMineData() {
    await this.loadBaseInfo()
    if (!hasMiniLogin()) {
      this.refreshAuthState()
      return
    }
    this.refreshAuthState(false)
    await Promise.all([
      this.loadMiniProfile(),
      this.loadOrderBadges(),
      this.loadCouponAssets(),
      this.loadPointAssets(),
      this.loadBalanceAssets(),
      this.loadAdoptAssets(),
    ])
  },

  refreshAuthState(loadRemote = true) {
    if (!hasMiniLogin()) {
      this.setData({
        loggedIn: false,
        greetText: getTimeGreetText(),
        user: { avatar: DEFAULT_AVATAR, nickname: STR_GUEST },
        assets: guestAssets(),
        orderEntries: orderEntries(),
        serviceEntries: serviceEntries(false),
      })
      return
    }

    this.setData({
      loggedIn: true,
      greetText: STR_WELCOME,
      assets: guestAssets(),
      orderEntries: orderEntries(),
      serviceEntries: serviceEntries(true),
    })
    try {
      const raw = wx.getStorageSync(MINI_PROFILE_KEY) as { avatar?: string; nickname?: string } | undefined
      if (raw && typeof raw === 'object') {
        this.setData({
          user: {
            avatar: raw.avatar || DEFAULT_AVATAR,
            nickname: raw.nickname || STR_DEFAULT_NICK,
          },
        })
      }
    } catch (_) {
      /* ignore */
    }
    if (loadRemote) {
      this.loadMiniProfile()
      this.loadOrderBadges()
      this.loadCouponAssets()
      this.loadPointAssets()
      this.loadBalanceAssets()
      this.loadAdoptAssets()
    }
  },

  async ensureLoginThen(next?: () => void) {
    if (this.data.loggedIn) {
      if (next) next()
      return true
    }
    try {
      wx.showLoading({ title: '登录中', mask: true })
      await ensureMiniLogin()
      wx.hideLoading()
      this.refreshAuthState()
      wx.showToast({ title: '登录成功', icon: 'success' })
      if (next) next()
      return true
    } catch (error) {
      wx.hideLoading()
      console.warn('login failed:', error)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      return false
    }
  },

  async loadMiniProfile() {
    try {
      const resp = (await getUserProfile()) as Record<string, unknown>
      if (Number(resp.code) !== 200) return
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const profile = ((source && source.data) || source) as Record<string, unknown>
      const avatar = String(profile.avatar || DEFAULT_AVATAR)
      const nickname = String(profile.nickname || STR_DEFAULT_NICK)
      this.setData({ user: { avatar, nickname } })
      wx.setStorageSync(MINI_PROFILE_KEY, { avatar, nickname })
    } catch (_) {
      /* ignore */
    }
  },

  async loadOrderBadges() {
    if (!this.data.loggedIn) return
    try {
      const resp = (await getMallOrderList('all')) as Record<string, unknown>
      if (Number(resp.code) !== 200 || !Array.isArray(resp.data)) return
      const counts: Record<string, number> = { unpaid: 0, unshipped: 0, unreceived: 0 }
      ;(resp.data as Record<string, unknown>[]).forEach((row) => {
        const status = String(row.status || '').trim()
        if (status === 'unpaid' || status === 'unshipped' || status === 'unreceived') {
          counts[status] = (counts[status] || 0) + 1
        }
      })
      const next = orderEntries().map((item) => ({ ...item, badge: counts[item.status] || 0 }))
      this.setData({ orderEntries: next })
    } catch (_) {
      // ignore
    }
  },

  async loadCouponAssets() {
    if (!this.data.loggedIn) return
    try {
      const resp = (await getCouponStats()) as Record<string, unknown>
      const data = (resp && resp.data) as Record<string, unknown>
      const current = this.data.assets
      this.setData({
        assets: {
          ...current,
          couponCount: String(data && data.unused != null ? data.unused : '0'),
        },
      })
    } catch (_) {
      // ignore
    }
  },

  async loadPointAssets() {
    if (!this.data.loggedIn) return
    try {
      const resp = (await getPointStats()) as Record<string, unknown>
      const data = (resp && resp.data) as Record<string, unknown>
      const current = this.data.assets
      this.setData({
        assets: {
          ...current,
          points: String(data && data.totalPoints != null ? data.totalPoints : '0'),
        },
      })
    } catch (_) {
      // ignore
    }
  },

  async loadBalanceAssets() {
    if (!this.data.loggedIn) return
    try {
      const resp = (await getBalanceStats()) as Record<string, unknown>
      const data = (resp && resp.data) as Record<string, unknown>
      const current = this.data.assets
      this.setData({
        assets: {
          ...current,
          balance: String(data && data.balance != null ? data.balance : '0.00'),
        },
      })
    } catch (_) {
      // ignore
    }
  },

  async loadAdoptAssets() {
    if (!this.data.loggedIn) return
    try {
      const resp = (await getMyAdoptArchive()) as Record<string, unknown>
      if (Number(resp.code) !== 200) return
      const rows = Array.isArray(resp.data) ? (resp.data as Record<string, unknown>[]) : []
      const current = this.data.assets
      this.setData({
        assets: {
          ...current,
          adoptCount: String(rows.length),
        },
      })
    } catch (_) {
      // ignore
    }
  },

  async loadBaseInfo() {
    try {
      const resp = (await getBaseInfo()) as Record<string, unknown>
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const base = ((source && source.data) || source) as Record<string, unknown>
      const nextFarm: FarmInfo = { ...this.data.farm }

      const cover = pickFirst(base, ['background', 'background_image', 'backgroundImage', 'bgImage', 'bg', 'logo', 'logoUrl', 'logo_url'])
      const name = pickFirst(base, ['siteName', 'name', 'farmName'])
      const slogan = pickFirst(base, ['slogan', 'siteSlogan', 'subtitle'])
      const phone = pickFirst(base, ['phone', 'tel', 'telephone'])
      const wechat = pickFirst(base, ['wechat', 'wx', 'weixin', 'wechatId'])
      const address = pickFirst(base, ['address', 'addr', 'location'])

      if (cover) nextFarm.cover = cover
      if (name) nextFarm.name = name
      if (slogan) nextFarm.slogan = slogan
      if (phone) nextFarm.phone = phone
      if (wechat) nextFarm.wechat = wechat
      if (address) nextFarm.address = address
      this.setData({ farm: nextFarm })
    } catch (_) {
      /* ignore */
    }
  },

  onLoginTap() {
    this.ensureLoginThen()
  },

  onAvatarTap() {
    this.ensureLoginThen(() => wx.navigateTo({ url: '/pages/profile-edit/profile-edit' }))
  },

  onProfileSettingsTap() {
    this.onAvatarTap()
  },

  onAssetDetailTap() {
    this.ensureLoginThen(() => wx.navigateTo({ url: '/pages/assets-detail/assets-detail' }))
  },

  onAssetCellTap(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as string
    const tabMap: Record<string, string> = { balance: 'balance', points: 'points', adopt: 'adopt', coupon: 'coupon' }
    const tab = tabMap[type] || 'balance'
    this.ensureLoginThen(() => wx.navigateTo({ url: `/pages/assets-detail/assets-detail?tab=${tab}` }))
  },

  onOrderAllTap() {
    this.ensureLoginThen(() => wx.navigateTo({ url: '/pages/order-list/order-list?tab=all' }))
  },

  onOrderStatusTap(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as string
    const tabMap: Record<string, string> = {
      unpaid: 'unpaid',
      unshipped: 'unshipped',
      unreceived: 'unreceived',
      pending_review: 'pending_review',
      completed: 'completed',
    }
    const tab = tabMap[status] || 'all'
    this.ensureLoginThen(() => wx.navigateTo({ url: `/pages/order-list/order-list?tab=${tab}` }))
  },

  onServiceTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return

    if (id === 'adopt_agreement') {
      wx.navigateTo({ url: '/pages/adopt-agreement/adopt-agreement' })
      return
    }

    if (id === 'logout') {
      wx.showModal({
        title: '退出登录',
        content: '确认退出当前账号吗？',
        confirmColor: '#4caf50',
        success: (res) => {
          if (!res.confirm) return
          clearMiniAuth()
          this.setData({
            loggedIn: false,
            greetText: getTimeGreetText(),
            user: { avatar: DEFAULT_AVATAR, nickname: STR_GUEST },
            assets: guestAssets(),
            orderEntries: orderEntries(),
            serviceEntries: serviceEntries(false),
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        },
      })
      return
    }

    this.ensureLoginThen(() => {
      if (id === 'address') return wx.navigateTo({ url: '/pages/address-list/address-list' })
      if (id === 'favorite') return wx.navigateTo({ url: '/pages/favorite-list/favorite-list' })
      if (id === 'activity') return wx.navigateTo({ url: '/pages/event/event' })
      if (id === 'service') {
        wx.showToast({ title: '已登录，请再次点击联系客服', icon: 'none' })
      }
    })
  },

  onFarmPhoneTap() {
    const phone = String(this.data.farm.phone).replace(/-/g, '')
    wx.makePhoneCall({ phoneNumber: phone })
  },

  onFarmWechatTap() {
    const wechat = String(this.data.farm.wechat || '').trim()
    if (!wechat) return wx.showToast({ title: '暂无微信号', icon: 'none' })
    wx.setClipboardData({
      data: wechat,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' }),
    })
  },

  onFarmNavigateTap() {
    const { farm } = this.data
    wx.openLocation({
      latitude: farm.latitude,
      longitude: farm.longitude,
      name: farm.name,
      address: farm.address,
      scale: 16,
      fail: () => wx.showToast({ title: '无法打开地图', icon: 'none' }),
    })
  },
})
