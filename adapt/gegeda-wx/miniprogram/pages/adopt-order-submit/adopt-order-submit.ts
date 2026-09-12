import {
  cancelAdoptOrder,
  confirmAdoptOrderPaid,
  createAdoptOrder,
  ensureMiniLogin,
  getAddressList,
  getAdoptProductDetail,
  getBalanceStats,
  getMyCouponList,
  requestSubscribeMessageForScenes,
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

interface CouponItem {
  id: string | number
  name: string
  amount: string
  couponType: string
  thresholdAmount?: string
  expireTime?: string
}

interface AdoptAvatarOption {
  id: string
  name: string
  image: string
}

interface AdoptProductDetail {
  id: string
  templateId: string
  title: string
  subtitle: string
  cover: string
  price: string
  adoptDays: number
  giftItemName: string
  giftItemUnit: string
  giftEggCount: number
  giftPeriodDays: number
  avatarOptions: AdoptAvatarOption[]
}

const INVOICE_STORAGE_KEY = 'gegeda_invoice_profile_v1'
const DEFAULT_ADOPT_AVATAR = '/images/adopt/adapt.svg'

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

function parseMoney(value: unknown): number {
  const amount = Number(value)
  if (Number.isNaN(amount) || amount < 0) return 0
  return amount
}

function formatMoney(value: number): string {
  return value.toFixed(2)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms))
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

function mapAvatarOptions(value: unknown): AdoptAvatarOption[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as Record<string, any>
      return {
        id: String(row.id || ''),
        name: String(row.name || ''),
        image: String(row.image || ''),
      }
    })
    .filter((item) => !!item.image)
}

function mapProduct(data: Record<string, any>): AdoptProductDetail {
  return {
    id: String(data.id || ''),
    templateId: String(data.templateId || data.template_id || ''),
    title: String(data.title || data.name || ''),
    subtitle: String(data.subtitle || ''),
    cover: String(data.cover || data.img || '/images/ad.jpg'),
    price: String(data.price || '0.00'),
    adoptDays: Number(data.adoptDays || data.adopt_days || 0),
    giftItemName: String(data.giftItemName || data.gift_item_name || '鸡蛋'),
    giftItemUnit: String(data.giftItemUnit || data.gift_item_unit || '枚'),
    giftEggCount: Number(data.giftEggCount || data.gift_egg_count || 0),
    giftPeriodDays: Number(data.giftPeriodDays || data.gift_period_days || 0),
    avatarOptions: mapAvatarOptions(data.avatarOptions || data.avatar_options),
  }
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

Page({
  data: {
    id: '',
    detail: null as AdoptProductDetail | null,
    adoptAvatarOptions: [] as AdoptAvatarOption[],
    selectedAdoptAvatar: '',
    address: null as AddressItem | null,
    loading: false,
    pageLoading: false,
    adoptName: '',
    buyerRemark: '希望它快快长大',
    balanceAvailable: '0.00',
    goodsAmount: '0.00',
    couponAmount: '0.00',
    payableAmount: '0.00',
    balanceUsed: '0.00',
    wechatPayAmount: '0.00',
    couponPopupVisible: false,
    couponList: [] as CouponItem[],
    selectedCoupon: null as CouponItem | null,
    selectedCouponId: '',
    couponSummary: '不使用优惠券',
    couponDisplayText: '暂无可用优惠券',
    usableCouponCount: 0,
    paymentMethod: '余额优先支付',
    invoiceInfo: null as InvoiceSaved | null,
    invoiceSummary: '不开票',
    invoicePopupVisible: false,
    invoiceForm: defaultInvoiceForm() as InvoiceForm,
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({ id: String(query.id || '') })
  },

  noop() {},

  async onShow() {
    const ok = await this.ensureLogin()
    if (!ok) return
    await this.bootstrap()
  },

  async ensureLogin() {
    try {
      await ensureMiniLogin()
      return true
    } catch (_) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 260)
      return false
    }
  },

  async bootstrap() {
    const id = String(this.data.id || '')
    if (!id) {
      wx.showToast({ title: '认养商品不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 260)
      return
    }

    this.setData({
      pageLoading: true,
      invoiceInfo: null,
      invoiceSummary: '不开票',
    })

    try {
      const [detailResp, balanceResp, addressResp] = await Promise.all([
        getAdoptProductDetail(id),
        getBalanceStats(),
        getAddressList(),
      ])

      const detailPayload = detailResp as Record<string, any>
      if (Number(detailPayload.code) !== 200 || !detailPayload.data) {
        wx.showToast({ title: '认养商品不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 260)
        return
      }

      const detail = mapProduct(detailPayload.data)
      const balanceData = ((balanceResp as Record<string, any>).data || {}) as Record<string, any>
      const addressRows = Array.isArray((addressResp as Record<string, any>).data)
        ? (addressResp as Record<string, any>).data.map((item: Record<string, unknown>) => toAddressRow(item))
        : []
      const address = addressRows.find((item: AddressItem) => item.isDefault) || addressRows[0] || null
      const adoptAvatarOptions = Array.isArray(detail.avatarOptions) ? detail.avatarOptions : []
      const selectedAdoptAvatar = adoptAvatarOptions[0] ? adoptAvatarOptions[0].image : DEFAULT_ADOPT_AVATAR

      this.setData({
        detail,
        adoptAvatarOptions,
        selectedAdoptAvatar,
        address,
        balanceAvailable: formatMoney(parseMoney(balanceData.balance || 0)),
      })
      this.refreshAmounts(detail, null)
      await this.loadCoupons(detail)
    } catch (error) {
      console.error('bootstrap adopt order error', error)
      wx.showToast({ title: '页面加载失败', icon: 'none' })
    } finally {
      this.setData({ pageLoading: false })
    }
  },

  refreshAmounts(detail: AdoptProductDetail, coupon: CouponItem | null) {
    const goodsAmount = parseMoney(detail.price)
    let couponAmount = 0
    if (coupon) {
      const discount = parseMoney(coupon.amount)
      if (String(coupon.couponType || '') === 'full_reduction') {
        const threshold = parseMoney(coupon.thresholdAmount || 0)
        couponAmount = goodsAmount >= threshold ? Math.min(discount, goodsAmount) : 0
      } else {
        couponAmount = Math.min(discount, goodsAmount)
      }
    }
    const payableAmount = Math.max(goodsAmount - couponAmount, 0)
    const balanceAvailable = parseMoney(this.data.balanceAvailable)
    const balanceUsed = Math.min(balanceAvailable, payableAmount)
    const wechatPayAmount = Math.max(payableAmount - balanceUsed, 0)

    this.setData({
      goodsAmount: formatMoney(goodsAmount),
      couponAmount: formatMoney(couponAmount),
      payableAmount: formatMoney(payableAmount),
      balanceUsed: formatMoney(balanceUsed),
      wechatPayAmount: formatMoney(wechatPayAmount),
      couponSummary: coupon ? `${coupon.name} · -¥${formatMoney(couponAmount)}` : '不使用优惠券',
      couponDisplayText: coupon
        ? `${coupon.name} · -¥${formatMoney(couponAmount)}`
        : (this.data.usableCouponCount > 0 ? `可用 ${this.data.usableCouponCount} 张` : '暂无可用优惠券'),
    })
  },

  async loadCoupons(detail: AdoptProductDetail) {
    try {
      const resp = (await getMyCouponList({
        scene: 'adopt',
        status: 'usable',
        orderAmount: detail.price,
        page: 1,
        pageSize: 50,
      })) as Record<string, any>
      const payload = (resp.data || {}) as Record<string, any>
      const list = Array.isArray(payload.list) ? (payload.list as CouponItem[]) : []
      this.setData({
        couponList: list,
        usableCouponCount: list.length,
        couponDisplayText: list.length > 0 ? `可用 ${list.length} 张` : '暂无可用优惠券',
      })
    } catch (error) {
      console.error('loadCoupons error', error)
      this.setData({ couponList: [], usableCouponCount: 0, couponDisplayText: '暂无可用优惠券' })
    }
  },

  onAddressTap() {
    wx.navigateTo({
      url: '/pages/address-list/address-list?select=1',
      events: {
        addressSelected: (address: AddressItem) => {
          this.setData({ address })
        },
      },
    })
  },

  onAdoptNameInput(e: WechatMiniprogram.Input) {
    this.setData({ adoptName: String(e.detail.value || '') })
  },

  onRemarkInput(e: WechatMiniprogram.Input) {
    this.setData({ buyerRemark: String(e.detail.value || '') })
  },

  onAdoptAvatarSelect(e: WechatMiniprogram.TouchEvent) {
    const image = String((e.currentTarget.dataset as { image?: string }).image || '')
    if (!image) return
    this.setData({ selectedAdoptAvatar: image })
  },

  onCouponTap() {
    this.setData({ couponPopupVisible: true })
  },

  onCouponClose() {
    this.setData({ couponPopupVisible: false })
  },

  onCouponSelect(e: WechatMiniprogram.TouchEvent) {
    const id = String((e.currentTarget.dataset as { id?: string | number }).id || '')
    const detail = this.data.detail
    if (!detail) return
    const selectedCoupon = this.data.couponList.find((item) => String(item.id) === id) || null
    this.setData({
      selectedCoupon,
      selectedCouponId: selectedCoupon ? String(selectedCoupon.id) : '',
      couponPopupVisible: false,
    })
    this.refreshAmounts(detail, selectedCoupon)
  },

  onCouponClear() {
    const detail = this.data.detail
    if (!detail) return
    this.setData({
      selectedCoupon: null,
      selectedCouponId: '',
      couponPopupVisible: false,
      couponSummary: '不使用优惠券',
      couponDisplayText: this.data.usableCouponCount > 0 ? `可用 ${this.data.usableCouponCount} 张` : '暂无可用优惠券',
    })
    this.refreshAmounts(detail, null)
  },

  onInvoiceTap() {
    const current = this.data.invoiceInfo || loadSavedInvoice()
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

  onInvoiceClear() {
    this.setData({
      invoiceInfo: null,
      invoiceSummary: '不开票',
      invoicePopupVisible: false,
      invoiceForm: defaultInvoiceForm(),
    })
  },

  onInvoiceTitleTypeTap(e: WechatMiniprogram.TouchEvent) {
    const type = String((e.currentTarget.dataset as { type?: string }).type || 'person')
    const titleType: InvoiceTitleType = type === 'company' ? 'company' : 'person'
    this.setData({ 'invoiceForm.titleType': titleType })
  },

  onInvoiceInput(e: WechatMiniprogram.Input) {
    const key = String((e.currentTarget.dataset as { key?: string }).key || '')
    if (!key) return
    this.setData({ ['invoiceForm.' + key]: String(e.detail.value || '') })
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
      wx.setStorageSync(INVOICE_STORAGE_KEY, next)
    }

    this.setData({
      invoiceInfo: next,
      invoiceSummary: `普票-商品明细-${invoiceDisplayName(next)}`,
      invoicePopupVisible: false,
    })
  },

  async handlePaidSuccess(orderNo: string) {
    wx.showLoading({ title: '支付中', mask: true })
    await wait(800)
    wx.hideLoading()
    wx.showToast({ title: '支付成功', icon: 'success', duration: 800 })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/adopt/adopt' })
    }, 800)
    console.log('adopt order paid', orderNo)
  },

  async rollbackPendingOrder(orderNo: string) {
    try {
      await cancelAdoptOrder(orderNo)
    } catch (error) {
      console.error('rollbackPendingOrder error', error)
    }
  },

  async confirmImmediateSuccess(orderNo: string) {
    const confirmResp = (await confirmAdoptOrderPaid(orderNo)) as Record<string, any>
    if (Number(confirmResp.code) !== 200) {
      wx.showToast({ title: String(confirmResp.msg || '支付结果确认失败'), icon: 'none' })
      return false
    }
    await this.handlePaidSuccess(orderNo)
    return true
  },

  async onSubmitTap() {
    if (this.data.loading) return
    const detail = this.data.detail
    const address = this.data.address
    const adoptName = String(this.data.adoptName || '').trim()
    if (!detail) {
      wx.showToast({ title: '认养商品不存在', icon: 'none' })
      return
    }
    if (!address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    if (!adoptName) {
      wx.showToast({ title: '请填写认养名称', icon: 'none' })
      return
    }

    await requestSubscribeMessageForScenes(['adopt_confirmed', 'adopt_gift_shipped'])

    this.setData({ loading: true })
    let orderNo = ''
    try {
      const resp = (await createAdoptOrder({
        productId: detail.id,
        adoptName,
        adoptAvatar: this.data.selectedAdoptAvatar,
        receiverName: address.name,
        receiverPhone: address.phone,
        receiverAddress: `${address.region} ${address.detail}`.trim(),
        buyerRemark: this.data.buyerRemark,
        couponId: this.data.selectedCoupon ? this.data.selectedCoupon.id : 0,
        invoice: this.data.invoiceInfo,
      })) as Record<string, any>

      if (Number(resp.code) !== 200 || !resp.data) {
        wx.showToast({ title: String(resp.msg || '提交认养订单失败'), icon: 'none' })
        return
      }

      const orderData = resp.data as Record<string, any>
      orderNo = String(orderData.orderNo || orderData.order_no || '')
      const paymentReady = !!orderData.paymentReady
      const payParams = (orderData.payParams || null) as Record<string, unknown> | null
      const wechatAmount = parseMoney(orderData.wechatAmount || orderData.wechat_amount || 0)

      if (!paymentReady || wechatAmount <= 0 || !payParams) {
        await this.confirmImmediateSuccess(orderNo)
        return
      }

      try {
        await requestPayment(payParams)
        const confirmResp = (await confirmAdoptOrderPaid(orderNo)) as Record<string, any>
        if (Number(confirmResp.code) !== 200) {
          wx.showToast({ title: String(confirmResp.msg || '支付结果确认失败'), icon: 'none' })
          return
        }
        await this.handlePaidSuccess(orderNo)
      } catch (error) {
        console.error('requestPayment adopt error', error)
        await this.rollbackPendingOrder(orderNo)
        const err = (error || {}) as Record<string, unknown>
        const errMsg = String(err.errMsg || '')
        if (errMsg.indexOf('cancel') >= 0) {
          wx.showToast({ title: '已取消支付', icon: 'none' })
        } else {
          wx.showToast({ title: '支付未完成，请重新提交', icon: 'none' })
        }
      }
    } catch (error) {
      console.error('createAdoptOrder error', error)
      if (orderNo) {
        await this.rollbackPendingOrder(orderNo)
      }
      wx.showToast({ title: '提交认养订单失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
