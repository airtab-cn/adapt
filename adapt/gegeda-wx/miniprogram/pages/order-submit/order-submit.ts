import {
  clearBuyNowDraft,
  confirmMallOrderPaid,
  createMallOrder,
  getAddressList,
  getBalanceStats,
  getBuyNowDraft,
  getMyCouponList,
  requestSubscribeMessageForScenes,
  type BuyNowDraft,
  type BuyNowDraftItem,
  type UserCouponItem,
} from '../../utils/api'

interface AddressItem {
  id: number
  name: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
}

type InvoiceTitleType = 'person' | 'company'

interface InvoiceForm {
  type: '普票'
  titleType: InvoiceTitleType
  personName: string
  companyName: string
  taxNo: string
  email: string
  setDefault: boolean
}

interface InvoiceSaved extends InvoiceForm {
  content: '商品明细'
}

const INVOICE_STORAGE_KEY = 'gegeda_invoice_profile_v1'

function toAddressRow(item: Record<string, unknown>): AddressItem {
  const province = String(item.province || '')
  const city = String(item.city || '')
  const district = String(item.district || '')
  const region = String(item.region || [province, city, district].filter(Boolean).join(' '))
  return {
    id: Number(item.id || 0),
    name: String(item.receiverName || item.receiver_name || item.name || ''),
    phone: String(item.phone || ''),
    region,
    detail: String(item.detail || ''),
    isDefault: !!(item.isDefault || item.is_default),
  }
}

function formatMoney(value: number): string {
  return value.toFixed(2)
}

function parseMoney(value: unknown): number {
  const amount = Number(value)
  if (Number.isNaN(amount) || amount < 0) return 0
  return amount
}

function getDraftItems(draft: BuyNowDraft): BuyNowDraftItem[] {
  if (draft.items && draft.items.length) return draft.items
  return [{
    productId: draft.productId,
    skuName: draft.skuName,
    title: draft.title,
    img: draft.img,
    price: draft.price,
    originPrice: draft.originPrice,
    quantity: draft.quantity,
    deliveryMode: draft.deliveryMode || '',
    shippingFee: draft.shippingFee || '0.00',
  }]
}

function summarizeDeliveryMode(items: BuyNowDraftItem[]): string {
  const modes = items.map((item) => String(item.deliveryMode || '').trim()).filter(Boolean)
  if (!modes.length) return ''
  return modes.every((mode) => mode === modes[0]) ? modes[0] : '多种配送'
}

function defaultInvoiceForm(): InvoiceForm {
  return {
    type: '普票',
    titleType: 'person',
    personName: '',
    companyName: '',
    taxNo: '',
    email: '',
    setDefault: false,
  }
}

function loadSavedInvoice(): InvoiceSaved | null {
  try {
    const raw = wx.getStorageSync(INVOICE_STORAGE_KEY) as unknown
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Record<string, unknown>
    const titleType = String(row.titleType || 'person') === 'company' ? 'company' : 'person'
    return {
      type: '普票',
      titleType,
      personName: String(row.personName || ''),
      companyName: String(row.companyName || ''),
      taxNo: String(row.taxNo || ''),
      email: String(row.email || ''),
      setDefault: true,
      content: '商品明细',
    }
  } catch (_) {
    return null
  }
}

function invoiceDisplayName(invoice: InvoiceSaved | null): string {
  if (!invoice) return ''
  return invoice.titleType === 'company' ? String(invoice.companyName || '') : String(invoice.personName || '')
}


function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

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
    draft: null as BuyNowDraft | null,
    orderItems: [] as BuyNowDraftItem[],
    isMultiGoods: false,
    address: null as AddressItem | null,
    deliveryModeText: '',
    goodsAmount: '0.00',
    freight: '0.00',
    couponAmount: '0.00',
    payableAmount: '0.00',
    balanceAvailable: '0.00',
    balanceUsed: '0.00',
    wechatPayAmount: '0.00',
    loading: false,
    hasManualAddress: false,
    paymentMethod: '余额优先支付',

    couponPopupVisible: false,
    couponLoading: false,
    couponList: [] as UserCouponItem[],
    selectedCoupon: null as UserCouponItem | null,
    selectedCouponId: '',
    couponSummary: '不使用优惠券',
    usableCouponCount: 0,

    invoiceInfo: null as InvoiceSaved | null,
    invoiceSummary: '不开发票',
    invoicePopupVisible: false,
    invoiceForm: defaultInvoiceForm() as InvoiceForm,
  },

  async onShow() {
    const draft = getBuyNowDraft()
    if (!draft || !draft.productId) {
      wx.showToast({ title: '购买信息已失效，请重新选择', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 300)
      return
    }

    const saved = loadSavedInvoice()
    const orderItems = getDraftItems(draft)
    this.setData({
      draft,
      orderItems,
      isMultiGoods: orderItems.length > 1,
      deliveryModeText: summarizeDeliveryMode(orderItems),
      invoiceInfo: saved,
      invoiceSummary: saved ? '普票-商品明细-' + invoiceDisplayName(saved) : '不开发票',
    })
    await this.loadBalanceStats()
    this.refreshAmounts(draft, this.data.selectedCoupon)
    await this.loadCoupons(draft)

    if (!this.data.hasManualAddress) {
      await this.loadDefaultAddress()
    }
  },

  calcGoodsAmount(draft: BuyNowDraft): number {
    return getDraftItems(draft).reduce((sum, item) => {
      return sum + parseMoney(item.price) * Math.max(1, Number(item.quantity) || 1)
    }, 0)
  },

  calcFreight(draft: BuyNowDraft): number {
    return getDraftItems(draft).reduce((sum, item) => {
      const mode = String(item.deliveryMode || '').trim()
      return sum + (mode === '快递到家' ? parseMoney(item.shippingFee || 0) : 0)
    }, 0)
  },

  calcCouponDiscount(coupon: UserCouponItem | null, goodsAmount: number): number {
    if (!coupon) return 0
    const amount = parseMoney(coupon.amount)
    if (coupon.couponType === 'full_reduction') {
      const threshold = parseMoney(coupon.thresholdAmount)
      if (goodsAmount < threshold) return 0
    }
    return amount
  },

  refreshAmounts(draft: BuyNowDraft, coupon: UserCouponItem | null) {
    const goodsAmount = this.calcGoodsAmount(draft)
    const freight = this.calcFreight(draft)
    const couponDiscount = Math.min(this.calcCouponDiscount(coupon, goodsAmount), goodsAmount + freight)
    const payableAmount = Math.max(goodsAmount + freight - couponDiscount, 0)
    const balanceAvailable = parseMoney(this.data.balanceAvailable)
    const balanceUsed = Math.min(balanceAvailable, payableAmount)
    const wechatPayAmount = Math.max(payableAmount - balanceUsed, 0)
    this.setData({
      goodsAmount: formatMoney(goodsAmount),
      freight: formatMoney(freight),
      couponAmount: formatMoney(couponDiscount),
      payableAmount: formatMoney(payableAmount),
      balanceUsed: formatMoney(balanceUsed),
      wechatPayAmount: formatMoney(wechatPayAmount),
      couponSummary: coupon ? coupon.name + ' · -¥' + formatMoney(couponDiscount) : '不使用优惠券',
    })
  },
  async loadBalanceStats() {
    try {
      const resp = (await getBalanceStats()) as Record<string, unknown>
      if (Number(resp.code) !== 200) return
      const payload = (resp.data || {}) as Record<string, unknown>
      this.setData({
        balanceAvailable: formatMoney(parseMoney(payload.balance || 0)),
      })
    } catch (_) {
      this.setData({ balanceAvailable: '0.00' })
    }
  },
  async loadCoupons(draft: BuyNowDraft) {
    this.setData({ couponLoading: true })
    try {
      const resp = (await getMyCouponList({
        scene: 'mall',
        status: 'usable',
        orderAmount: this.calcGoodsAmount(draft),
        page: 1,
        pageSize: 50,
      })) as Record<string, unknown>
      const payload = (resp && resp.data) as Record<string, unknown>
      const listRaw = payload && Array.isArray(payload.list) ? payload.list : []
      const couponList = listRaw as UserCouponItem[]
      let selectedCoupon = this.data.selectedCoupon
      if (selectedCoupon) {
        selectedCoupon = couponList.find((item) => String(item.id) === String(selectedCoupon && selectedCoupon.id)) || null
      }
      this.setData({
        couponList,
        selectedCoupon,
        selectedCouponId: selectedCoupon ? String(selectedCoupon.id) : '',
        usableCouponCount: couponList.length,
      })
      this.refreshAmounts(draft, selectedCoupon)
    } catch (_) {
      this.setData({ couponList: [], selectedCoupon: null, selectedCouponId: '', usableCouponCount: 0 })
      this.refreshAmounts(draft, null)
    } finally {
      this.setData({ couponLoading: false })
    }
  },

  async loadDefaultAddress() {
    try {
      const resp = (await getAddressList()) as Record<string, unknown>
      if (Number(resp.code) !== 200) return
      const rows = Array.isArray(resp.data) ? resp.data.map((x) => toAddressRow(x as Record<string, unknown>)) : []
      const pick = rows.find((x) => x.isDefault) || rows[0] || null
      this.setData({ address: pick })
    } catch (_) {
      // ignore
    }
  },

  onAddressTap() {
    wx.navigateTo({
      url: '/pages/address-list/address-list?select=1',
      events: {
        addressSelected: (address: AddressItem) => {
          this.setData({ address, hasManualAddress: true })
        },
      },
    })
  },

  onCouponTap() {
    this.setData({ couponPopupVisible: true })
  },

  onCouponClose() {
    this.setData({ couponPopupVisible: false })
  },

  onCouponSelect(e: WechatMiniprogram.TouchEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    const draft = this.data.draft
    if (!draft) return
    const selectedCoupon = this.data.couponList.find((item) => String(item.id) === id) || null
    this.setData({
      selectedCoupon,
      selectedCouponId: selectedCoupon ? String(selectedCoupon.id) : '',
      couponPopupVisible: false,
    })
    this.refreshAmounts(draft, selectedCoupon)
  },

  onCouponClear() {
    const draft = this.data.draft
    if (!draft) return
    this.setData({ selectedCoupon: null, selectedCouponId: '', couponPopupVisible: false })
    this.refreshAmounts(draft, null)
  },

  onInvoiceTap() {
    const current = this.data.invoiceInfo
    const base = defaultInvoiceForm()
    if (current) {
      base.titleType = current.titleType
      base.personName = current.personName
      base.companyName = current.companyName
      base.taxNo = current.taxNo
      base.email = current.email
      base.setDefault = true
    }
    this.setData({
      invoicePopupVisible: true,
      invoiceForm: base,
    })
  },

  onInvoiceClose() {
    this.setData({ invoicePopupVisible: false })
  },

  noop() {},

  onInvoiceTitleTypeTap(e: WechatMiniprogram.TouchEvent) {
    const type = String((e.currentTarget.dataset as { type?: string }).type || 'person')
    const titleType: InvoiceTitleType = type === 'company' ? 'company' : 'person'
    this.setData({ 'invoiceForm.titleType': titleType })
  },

  onInvoiceInput(e: WechatMiniprogram.Input) {
    const key = String((e.currentTarget.dataset as { key?: string }).key || '')
    if (!key) return
    this.setData({ ["invoiceForm." + key]: String(e.detail.value || '') })
  },

  onInvoiceSetDefaultChange(e: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({ 'invoiceForm.setDefault': !!e.detail.value })
  },

  validateInvoice(form: InvoiceForm): { ok: boolean; msg: string } {
    if (form.titleType === 'person') {
      if (!String(form.personName || '').trim()) return { ok: false, msg: '请填写姓名' }
      if (!String(form.email || '').trim()) return { ok: false, msg: '请填写接收邮箱' }
      return { ok: true, msg: '' }
    }
    if (!String(form.companyName || '').trim()) return { ok: false, msg: '请填写单位名称' }
    if (!String(form.taxNo || '').trim()) return { ok: false, msg: '请填写纳税人识别码' }
    if (!String(form.email || '').trim()) return { ok: false, msg: '请填写接收邮箱' }
    return { ok: true, msg: '' }
  },

  onInvoiceConfirm() {
    const form = this.data.invoiceForm
    const check = this.validateInvoice(form)
    if (!check.ok) {
      wx.showToast({ title: check.msg, icon: 'none' })
      return
    }

    const next: InvoiceSaved = {
      type: '普票',
      titleType: form.titleType,
      personName: String(form.personName || '').trim(),
      companyName: String(form.companyName || '').trim(),
      taxNo: String(form.taxNo || '').trim(),
      email: String(form.email || '').trim(),
      setDefault: !!form.setDefault,
      content: '商品明细',
    }

    if (next.setDefault) {
      try {
        wx.setStorageSync(INVOICE_STORAGE_KEY, next)
      } catch (_) {
        // ignore
      }
    }

    const name = invoiceDisplayName(next)
    this.setData({
      invoiceInfo: next,
      invoiceSummary: '普票-商品明细-' + name,
      invoicePopupVisible: false,
    })
  },

  async onSubmitTap() {
    if (this.data.loading) return
    const draft = this.data.draft
    if (!draft) return
    const address = this.data.address
    if (!address) {
      wx.showToast({ title: '请先添加收货地址', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.showLoading({ title: '支付中', mask: true })
    try {
      await requestSubscribeMessageForScenes(['mall_paid', 'mall_shipped', 'mall_completed'])

      const resp = (await createMallOrder({
        draft,
        receiverName: address.name,
        receiverPhone: address.phone,
        receiverAddress: address.region + ' ' + address.detail,
        paymentMethod: this.data.paymentMethod,
        invoice: (this.data.invoiceInfo || null) as unknown as Record<string, unknown> | null,
        couponId: this.data.selectedCoupon ? this.data.selectedCoupon.id : 0,
      })) as Record<string, unknown>

      if (Number(resp.code) === 401) {
        wx.showToast({ title: '登录状态已失效，请重新登录后再支付', icon: 'none' })
        return
      }
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '提交订单失败'), icon: 'none' })
        return
      }

      const order = (resp.data || {}) as Record<string, unknown>
      const orderNo = String(order.orderNo || order.order_no || order.no || '')
      const payParams = (order.payParams || order.pay_params || null) as Record<string, unknown> | null
      const paymentReady = !!(order.paymentReady || order.payment_ready || payParams)
      const paymentMessage = String(order.paymentMessage || order.payment_message || '')
      const orderStatus = String(order.status || order.order_status || '')
      const payStatus = String(order.payStatus || order.pay_status || '')

      if (!paymentReady || !payParams) {
        clearBuyNowDraft()
        if (payStatus === 'success' || orderStatus === 'unshipped') {
          wx.showLoading({ title: '\u652f\u4ed8\u4e2d', mask: true })
          await wait(2000)
          wx.hideLoading()
          wx.showToast({ title: '\u652f\u4ed8\u6210\u529f', icon: 'success', duration: 1800 })
          wx.redirectTo({ url: '/pages/order-list/order-list?tab=unshipped' })
          return
        }
        wx.showToast({ title: paymentMessage || '订单已创建，请稍后支付', icon: 'none' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/order-list/order-list?tab=unpaid' })
        }, 260)
        return
      }

      wx.hideLoading()
      await requestPayment(payParams)
      wx.showLoading({ title: '确认支付中', mask: true })
      const confirmResp = (await confirmMallOrderPaid(orderNo)) as Record<string, unknown>
      wx.hideLoading()

      if (Number(confirmResp.code) === 401) {
        wx.showToast({ title: '登录状态已失效，请重新登录后查看订单', icon: 'none' })
        return
      }

      if (Number(confirmResp.code) === 200) {
        clearBuyNowDraft()
        wx.showToast({ title: '\u652f\u4ed8\u6210\u529f', icon: 'success', duration: 1800 })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/order-list/order-list?tab=unshipped' })
        }, 1600)
        return
      }

      wx.showToast({ title: String(confirmResp.msg || '支付成功，订单状态确认中'), icon: 'none' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/order-list/order-list?tab=unpaid' })
      }, 260)
    } catch (error) {
      const err = error as { errMsg?: string }
      const errMsg = err && err.errMsg ? String(err.errMsg) : ''
      if (errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付，可稍后继续', icon: 'none' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/order-list/order-list?tab=unpaid' })
        }, 260)
      } else {
        wx.showToast({ title: '提交订单失败，请重试', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },
})
