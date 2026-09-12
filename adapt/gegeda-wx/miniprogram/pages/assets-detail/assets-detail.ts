import {
  confirmBalanceRechargePaid,
  createBalanceRechargeOrder,
  getBalancePackageList,
  getBalanceRechargeRecordList,
  getMyAdoptArchive,
  getBalanceStats,
  getMyCouponList,
  getPointRecordList,
  repayBalanceRechargeOrder,
  type BalanceRechargePackageItem,
  type BalanceRechargeRecordItem,
  type PointRecordItem,
  type UserCouponItem,
} from '../../utils/api'

type AssetTabType = 'balance' | 'points' | 'adopt' | 'coupon'

interface AssetTabItem {
  id: AssetTabType
  label: string
}

type BalanceRechargeRecordViewItem = BalanceRechargeRecordItem & {
  displayTitle?: string
}

interface AdoptArchiveItem {
  id?: string | number
  orderNo?: string
  order_no?: string
  status?: string
  statusText?: string
  status_text?: string
  title?: string
  cover?: string
  adoptName?: string
  adopt_name?: string
  adoptAvatar?: string
  adopt_avatar?: string
  adoptDays?: number
  adopt_days?: number
  giftItemName?: string
  gift_item_name?: string
  giftItemCount?: number
  gift_item_count?: number
  giftItemUnit?: string
  gift_item_unit?: string
  giftPeriodDays?: number
  gift_period_days?: number
  payAmount?: string
  pay_amount?: string
  amount?: string
  payTime?: string
  pay_time?: string
  confirmTime?: string
  confirm_time?: string
}

const TABS: AssetTabItem[] = [
  { id: 'balance', label: '\u4f59\u989d' },
  { id: 'points', label: '\u79ef\u5206' },
  { id: 'adopt', label: '\u8ba4\u517b' },
  { id: 'coupon', label: '\u4f18\u60e0\u5238' },
]

function requestPayment(payParams: Record<string, unknown>) {
  return new Promise<void>((resolve, reject) => {
    wx.requestPayment({
      timeStamp: String(payParams.timeStamp || ''),
      nonceStr: String(payParams.nonceStr || ''),
      package: String(payParams.package || ''),
      signType: String(payParams.signType || 'RSA') as WechatMiniprogram.RequestPaymentOption['signType'],
      paySign: String(payParams.paySign || ''),
      success: () => resolve(),
      fail: (error) => reject(error),
    })
  })
}

Page({
  data: {
    tabs: TABS,
    activeTab: 'balance' as AssetTabType,
    pointList: [] as PointRecordItem[],
    pointLoading: false,
    balance: '0.00',
    balancePackageList: [] as BalanceRechargePackageItem[],
    balanceRecordList: [] as BalanceRechargeRecordViewItem[],
    balanceLoading: false,
    balancePage: 1,
    balancePageSize: 10,
    balanceHasMore: true,
    balanceLoadingMore: false,
    rechargingNo: '',
    couponList: [] as UserCouponItem[],
    availableCouponList: [] as UserCouponItem[],
    historyCouponList: [] as UserCouponItem[],
    showCouponHistory: false,
    couponLoading: false,
    adoptList: [] as AdoptArchiveItem[],
    adoptLoading: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const tab = query.tab as AssetTabType | undefined
    const activeTab = tab && ['balance', 'points', 'adopt', 'coupon'].includes(tab) ? tab : 'balance'
    this.setData({ activeTab })
    this.loadActiveTabData(activeTab)
  },

  onReachBottom() {
    if (this.data.activeTab === 'balance') {
      this.fetchBalanceRecords(false)
    }
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: AssetTabType }).id
    if (!id || id === this.data.activeTab) return
    this.setData({ activeTab: id })
    this.loadActiveTabData(id)
  },

  loadActiveTabData(tab: AssetTabType) {
    if (tab === 'balance') {
      this.fetchBalanceData(true)
      return
    }
    if (tab === 'points') {
      this.fetchPoints()
      return
    }
    if (tab === 'coupon') {
      this.fetchCoupons()
      return
    }
    if (tab === 'adopt') {
      this.fetchAdopts()
    }
  },

  async fetchBalanceData(reset = false) {
    this.setData({ balanceLoading: true })
    try {
      const [statsResp, packageResp] = await Promise.all([
        getBalanceStats(),
        getBalancePackageList(),
      ])
      const stats = ((statsResp as Record<string, unknown>).data || {}) as Record<string, unknown>
      const packageList = Array.isArray((packageResp as Record<string, unknown>).data)
        ? ((packageResp as Record<string, unknown>).data as BalanceRechargePackageItem[])
        : []
      this.setData({
        balance: String(stats.balance || '0.00'),
        balancePackageList: packageList,
      })
      await this.fetchBalanceRecords(reset)
    } catch (_) {
      wx.showToast({ title: '余额信息加载失败', icon: 'none' })
    } finally {
      this.setData({ balanceLoading: false })
    }
  },

  async fetchBalanceRecords(reset = false) {
    if (this.data.balanceLoadingMore) return
    const page = reset ? 1 : this.data.balancePage
    if (!reset && !this.data.balanceHasMore) return
    this.setData({ balanceLoadingMore: true })
    try {
      const resp = (await getBalanceRechargeRecordList({
        page,
        pageSize: this.data.balancePageSize,
      })) as Record<string, unknown>
      const payload = (resp.data || {}) as Record<string, unknown>
      const listRaw = Array.isArray(payload.list) ? (payload.list as BalanceRechargeRecordItem[]) : []
      const listMapped = listRaw.map((item) => {
        const title = String(item.packageName || '').trim()
        const isNumberTitle = /^[0-9]+(\.[0-9]+)?$/.test(title)
        return {
          ...item,
          displayTitle: title ? (isNumberTitle ? `\u00A5${title}` : title) : `\u00A5${item.actualAmount}`,
        }
      })
      const nextList = reset ? listMapped : this.data.balanceRecordList.concat(listMapped)
      this.setData({
        balanceRecordList: nextList,
        balancePage: page + 1,
        balanceHasMore: listRaw.length >= this.data.balancePageSize,
      })
    } catch (_) {
      if (!reset) {
        wx.showToast({ title: '充值记录加载失败', icon: 'none' })
      }
    } finally {
      this.setData({ balanceLoadingMore: false })
    }
  },

  async fetchPoints() {
    this.setData({ pointLoading: true })
    try {
      const resp = (await getPointRecordList({ page: 1, pageSize: 100 })) as Record<string, unknown>
      const payload = (resp.data || {}) as Record<string, unknown>
      const listRaw = Array.isArray(payload.list) ? payload.list : []
      this.setData({ pointList: listRaw as PointRecordItem[] })
    } catch (_) {
      wx.showToast({ title: '积分记录加载失败', icon: 'none' })
    } finally {
      this.setData({ pointLoading: false })
    }
  },

  async fetchCoupons() {
    this.setData({ couponLoading: true })
    try {
      const resp = (await getMyCouponList({ page: 1, pageSize: 100 })) as Record<string, unknown>
      const payload = (resp.data || {}) as Record<string, unknown>
      const listRaw = Array.isArray(payload.list) ? payload.list : []
      const couponList = listRaw as UserCouponItem[]
      const availableCouponList = couponList.filter((item) => String(item.status || '') === 'unused')
      const historyCouponList = couponList.filter((item) => String(item.status || '') !== 'unused')
      this.setData({
        couponList,
        availableCouponList,
        historyCouponList,
        showCouponHistory: false,
      })
    } catch (_) {
      wx.showToast({ title: '优惠券加载失败', icon: 'none' })
    } finally {
      this.setData({ couponLoading: false })
    }
  },

  async fetchAdopts() {
    this.setData({ adoptLoading: true })
    try {
      const resp = (await getMyAdoptArchive()) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '\u8ba4\u517b\u8bb0\u5f55\u52a0\u8f7d\u5931\u8d25'), icon: 'none' })
        return
      }
      const rows = Array.isArray(resp.data) ? (resp.data as AdoptArchiveItem[]) : []
      this.setData({ adoptList: rows })
    } catch (_) {
      wx.showToast({ title: '\u8ba4\u517b\u8bb0\u5f55\u52a0\u8f7d\u5931\u8d25', icon: 'none' })
    } finally {
      this.setData({ adoptLoading: false })
    }
  },

  onToggleCouponHistory() {
    this.setData({ showCouponHistory: !this.data.showCouponHistory })
  },

  async submitRecharge(action: 'create' | 'repay', value: string | number) {
    try {
      this.setData({ rechargingNo: String(value || '') })
      wx.showLoading({ title: action === 'create' ? '创建充值单' : '拉起支付中', mask: true })
      const resp = (action === 'create'
        ? await createBalanceRechargeOrder(value)
        : await repayBalanceRechargeOrder(String(value))) as Record<string, unknown>
      wx.hideLoading()
      if (Number(resp.code) === 401) {
        wx.showToast({ title: '登录状态已失效，请重新登录', icon: 'none' })
        return
      }
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '充值失败'), icon: 'none' })
        return
      }

      const data = (resp.data || {}) as Record<string, unknown>
      const rechargeNo = String(data.rechargeNo || data.recharge_no || '')
      const payParams = (data.payParams || data.pay_params || null) as Record<string, unknown> | null
      const paymentReady = !!(data.paymentReady || data.payment_ready || payParams)
      const paymentMessage = String(data.paymentMessage || data.payment_message || '')

      if (!paymentReady || !payParams) {
        wx.showToast({ title: paymentMessage || '暂时无法发起支付', icon: 'none' })
        this.fetchBalanceData(true)
        return
      }

      await requestPayment(payParams)
      wx.showLoading({ title: '确认支付中', mask: true })
      const confirmResp = (await confirmBalanceRechargePaid(rechargeNo)) as Record<string, unknown>
      wx.hideLoading()
      if (Number(confirmResp.code) === 200) {
        wx.showToast({ title: '充值成功', icon: 'success', duration: 1800 })
        this.fetchBalanceData(true)
        return
      }
      wx.showToast({ title: String(confirmResp.msg || '充值确认失败'), icon: 'none' })
      this.fetchBalanceData(true)
    } catch (error) {
      wx.hideLoading()
      const err = error as { errMsg?: string }
      const errMsg = String((err && err.errMsg) || '')
      if (errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        wx.showToast({ title: '充值失败，请重试', icon: 'none' })
      }
      this.fetchBalanceRecords(true)
    } finally {
      this.setData({ rechargingNo: '' })
    }
  },

  onRechargeTap(e: WechatMiniprogram.TouchEvent) {
    const packageId = (e.currentTarget.dataset as { id?: string | number }).id
    if (!packageId) return
    this.submitRecharge('create', packageId)
  },

  onRechargeRecordTap(e: WechatMiniprogram.TouchEvent) {
    const dataset = e.currentTarget.dataset as { no?: string; status?: string }
    const rechargeNo = dataset.no
    const status = String(dataset.status || '')
    if (!rechargeNo || status !== 'pending') return
    this.submitRecharge('repay', rechargeNo)
  },
})
