import {
  cancelMallOrder,
  confirmMallOrderReceived,
  confirmMallOrderPaid,
  createMallAfterSale,
  createMallOrderReview,
  getBaseInfo,
  getExpressCompanyOptions,
  getMallOrderDetail,
  repayMallOrder,
  requestSubscribeMessageForScenes,
  submitMallAfterSaleReturn,
  type MallOrder,
  type MallOrderItem,
  uploadMallAfterSaleEvidence,
  uploadMallReviewImage,
} from '../../utils/api'

interface ProgressStep {
  label: string
  time: string
  active: boolean
}

interface InvoiceLine {
  label: string
  value: string
}

interface ExpressCompanyOption {
  id: number
  name: string
  code: string
}

function normalizeOrder(order: MallOrder | null): MallOrder | null {
  if (!order) return null
  const expressTracks = Array.isArray(order.expressTracks) ? [...order.expressTracks].reverse() : []
  let nextAfterSale = order.afterSale || null
  if (nextAfterSale) {
    const returnTracks = Array.isArray(nextAfterSale.returnExpressTracks)
      ? [...nextAfterSale.returnExpressTracks].reverse()
      : []
    nextAfterSale = {
      ...nextAfterSale,
      returnExpressTracks: returnTracks,
    }
  }
  return {
    ...order,
    expressTracks,
    afterSale: nextAfterSale,
  }
}

function buildStatusCopy(order: MallOrder | null) {
  const status = String((order && order.status) || '')
  const headlineMap: Record<string, string> = {
    unpaid: '请尽快完成支付。',
    unshipped: '商家正在备货',
    unreceived: '商品正在配送中',
    pending_review: '订单待评价',
    completed: '订单已经完成，感谢您的支持与信任。',
    closed: '订单已取消',
    aftersale: '售后处理中',
    returning: '退货寄回中',
    pending_refund: '等待退款处理',
    aftersale_done: '售后已完成',
    refunding: '退款处理中',
    refunded: '退款已完成',
  }
  const descMap: Record<string, string> = {
    unpaid: '',
    unshipped: '',
    unreceived: '',
    pending_review: '',
    completed: '',
    closed: '该订单已结束，如有需要可以重新下单。',
    aftersale: '你的售后申请正在处理，请留意审核结果。',
    returning: '请关注退货物流进度，包裹签收后将进入待退款。',
    pending_refund: '平台已收到退货或审核通过，仅需等待后台确认退款。',
    aftersale_done: '本次售后已处理完成，感谢你的耐心等待。',
    refunding: '退款正在原路退回，请耐心等待到账。',
    refunded: '退款已经完成，请注意查收。',
  }
  return {
    headline: headlineMap[status] || '订单详情',
    description: descMap[status] || '',
  }
}

function buildProgress(order: MallOrder | null): ProgressStep[] {
  const status = String((order && order.status) || '')
  const createTime = String((order && (order.createTime || order.time)) || '')
  const payTime = String((order && order.payTime) || '')
  const shippedTime = String((order && order.shippedTime) || '')
  const updateTime = String((order && order.updateTime) || '')

  if (status === 'closed') {
    return [
      { label: '提交订单', time: createTime, active: true },
      { label: '取消订单', time: updateTime || createTime, active: true },
    ]
  }

  const paidStatuses = ['unshipped', 'unreceived', 'pending_review', 'completed', 'aftersale', 'returning', 'pending_refund', 'aftersale_done', 'refunding', 'refunded']
  const shippedStatuses = ['unreceived', 'pending_review', 'completed', 'aftersale', 'returning', 'pending_refund', 'aftersale_done', 'refunding', 'refunded']
  let lastLabel = '交易完成'
  if (status === 'pending_review') lastLabel = '待评价'
  else if (status === 'aftersale') lastLabel = '售后处理中'
  else if (status === 'returning') lastLabel = '退货中'
  else if (status === 'pending_refund') lastLabel = '待退款'
  else if (status === 'aftersale_done' || status === 'refunded') lastLabel = '售后完成'
  else if (status === 'completed') lastLabel = '已完成'

  return [
    { label: '提交订单', time: createTime, active: !!createTime },
    {
      label: status === 'unpaid' ? '等待支付' : '支付完成',
      time: payTime,
      active: paidStatuses.indexOf(status) >= 0,
    },
    {
      label: shippedStatuses.indexOf(status) >= 0 ? '已发货' : '待发货',
      time: shippedTime,
      active: shippedStatuses.indexOf(status) >= 0,
    },
    {
      label: lastLabel,
      time: updateTime,
      active: ['pending_review', 'completed', 'aftersale', 'returning', 'pending_refund', 'aftersale_done', 'refunding', 'refunded'].indexOf(status) >= 0,
    },
  ]
}

function buildInvoiceSummary(invoice: Record<string, unknown> | null | undefined): string {
  if (!invoice || typeof invoice !== 'object') return '未开发票'
  const titleType = String(invoice.titleType || 'person')
  const name = titleType === 'company' ? String(invoice.companyName || '') : String(invoice.personName || '')
  return `普票 - 商品明细 - ${name || '未填写'}`
}

function buildInvoiceLines(invoice: Record<string, unknown> | null | undefined): InvoiceLine[] {
  if (!invoice || typeof invoice !== 'object') {
    return [{ label: '发票状态', value: '未开发票' }]
  }
  const titleType = String(invoice.titleType || 'person')
  const rows: InvoiceLine[] = [
    { label: '发票类型', value: '普票' },
    { label: '抬头类型', value: titleType === 'company' ? '单位' : '个人' },
    {
      label: '抬头名称',
      value: titleType === 'company' ? String(invoice.companyName || '--') : String(invoice.personName || '--'),
    },
    { label: '发票内容', value: String(invoice.content || '商品明细') },
    { label: '接收邮箱', value: String(invoice.email || '--') },
  ]
  if (titleType === 'company') {
    rows.splice(3, 0, {
      label: '纳税人识别码',
      value: String(invoice.taxNo || '--'),
    })
  }
  return rows
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


function getOrderItems(order: (MallOrder & { payStatusText?: string }) | null): MallOrderItem[] {
  if (!order) return []
  const rows = Array.isArray(order.items) && order.items.length ? order.items : (Array.isArray(order.orderItems) ? order.orderItems : [])
  if (rows.length) return rows
  return [{
    productId: order.productId,
    title: order.title,
    cover: order.cover,
    skuName: order.specs || '默认规格',
    deliveryMode: order.deliveryMode || '',
    quantity: order.quantity || order.qty || 1,
    goodsAmount: order.goodsAmount || order.amount,
    shippingFee: order.shippingFee || '0.00',
  }]
}

function withPayStatusText(order: MallOrder | null): (MallOrder & { payStatusText?: string }) | null {
  if (!order) return null
  const nextOrder = normalizeOrder(order)
  if (!nextOrder) return null
  const payStatus = String(order.payStatus || '')
  const payStatusText =
    payStatus === 'success'
      ? '支付成功'
      : payStatus === 'pending'
        ? '待支付'
        : payStatus === 'failed'
          ? '支付失败'
          : payStatus === 'refunded'
            ? '已退款'
            : '--'
  return {
    ...nextOrder,
    payStatusText,
  }
}

Page({
  data: {
    orderNo: '',
    loading: true,
    paying: false,
    receiving: false,
    afterSaleSubmitting: false,
    returnSubmitting: false,
    reviewSubmitting: false,
    order: null as (MallOrder & { payStatusText?: string }) | null,
    orderItems: [] as MallOrderItem[],
    statusHeadline: '',
    statusDescription: '',
    progressSteps: [] as ProgressStep[],
    invoiceSummary: '未开发票',
    invoiceLines: [] as InvoiceLine[],
    afterSaleVisible: false,
    afterSaleType: 'refund_only',
    afterSaleReason: '',
    afterSaleReasonCount: 0,
    afterSaleEvidenceImage: '',
    returnVisible: false,
    returnExpressCompanyOptions: [] as ExpressCompanyOption[],
    returnExpressCompanyNames: [] as string[],
    returnExpressCompanyIndex: 0,
    returnExpressCompany: '',
    returnExpressNo: '',
    returnReceiverName: '',
    returnReceiverPhone: '',
    returnReceiverAddress: '',
    reviewStarOptions: [
      { full: 1, half: 0.5 },
      { full: 2, half: 1.5 },
      { full: 3, half: 2.5 },
      { full: 4, half: 3.5 },
      { full: 5, half: 4.5 },
    ],
    reviewVisible: false,
    reviewScore: 5,
    reviewContent: '',
    reviewContentCount: 0,
    reviewImages: [] as string[],
  },

  onLoad(query: Record<string, string | undefined>) {
    const orderNo = String(query.orderNo || '')
    this.setData({ orderNo })
    this.loadReturnMeta()
    this.loadDetail()
  },

  async loadReturnMeta() {
    try {
      const results = await Promise.all([
        getBaseInfo() as Promise<Record<string, unknown>>,
        getExpressCompanyOptions() as Promise<Record<string, unknown>>,
      ])
      const baseResp = results[0]
      const expressResp = results[1]
      const baseData = (baseResp && baseResp.data ? (baseResp.data as Record<string, unknown>) : {}) || {}
      const expressList = (expressResp && expressResp.data && Array.isArray(expressResp.data)
        ? (expressResp.data as Array<Record<string, unknown>>)
        : []) || []
      const options = expressList.map((item) => ({
        id: Number(item.id || 0),
        name: String(item.name || ''),
        code: String(item.code || ''),
      }))

      this.setData({
        returnReceiverName: String(baseData.siteName || baseData.name || ''),
        returnReceiverPhone: String(baseData.phone || ''),
        returnReceiverAddress: String(baseData.address || ''),
        returnExpressCompanyOptions: options,
        returnExpressCompanyNames: options.map((item) => item.name),
      })
    } catch (_) {
      // ignore
    }
  },

  async loadDetail() {
    if (!this.data.orderNo) {
      wx.showToast({ title: '缺少订单号', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const resp = (await getMallOrderDetail(this.data.orderNo)) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '获取订单详情失败'), icon: 'none' })
        return
      }
      this.applyOrder((resp.data || null) as MallOrder | null)
    } catch (_) {
      wx.showToast({ title: '获取订单详情失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyOrder(order: MallOrder | null) {
    const nextOrder = withPayStatusText(order)
    const statusCopy = buildStatusCopy(nextOrder)
    const invoice =
      nextOrder && nextOrder.invoice && typeof nextOrder.invoice === 'object'
        ? (nextOrder.invoice as Record<string, unknown>)
        : null
    this.setData({
      order: nextOrder,
      orderItems: getOrderItems(nextOrder),
      statusHeadline: statusCopy.headline,
      statusDescription: statusCopy.description,
      progressSteps: buildProgress(nextOrder),
      invoiceSummary: buildInvoiceSummary(invoice),
      invoiceLines: buildInvoiceLines(invoice),
    })
  },

  async onRepayTap() {
    const order = this.data.order
    if (!order) return
    const status = String(order.status || '')
    if (status !== 'unpaid' && status !== 'unshipped') return
    this.setData({ paying: true })
    try {
      const resp = (await repayMallOrder(String(order.orderNo || order.no || ''))) as Record<string, unknown>
      if (Number(resp.code) === 401) {
        wx.showToast({ title: '登录状态已失效，请重新登录后支付', icon: 'none' })
        return
      }
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '继续支付失败'), icon: 'none' })
        return
      }

      const orderData = (resp.data || {}) as Record<string, unknown>
      const payParams = (orderData.payParams || orderData.pay_params || null) as Record<string, unknown> | null
      const paymentReady = !!(orderData.paymentReady || orderData.payment_ready || payParams)
      const paymentMessage = String(orderData.paymentMessage || orderData.payment_message || '')

      if (!paymentReady || !payParams) {
        wx.showToast({ title: paymentMessage || '暂时无法发起支付', icon: 'none' })
        return
      }

      await requestPayment(payParams)
      wx.showLoading({ title: '确认支付中', mask: true })
      const confirmResp = (await confirmMallOrderPaid(String(order.orderNo || order.no || ''))) as Record<string, unknown>
      wx.hideLoading()

      if (Number(confirmResp.code) === 401) {
        wx.showToast({ title: '支付完成，但登录状态失效，请重新进入订单查看', icon: 'none' })
        return
      }
      if (Number(confirmResp.code) === 200) {
        this.applyOrder((confirmResp.data || null) as MallOrder | null)
        wx.showToast({ title: '支付成功', icon: 'success' })
        return
      }

      wx.showToast({ title: String(confirmResp.msg || '支付确认失败'), icon: 'none' })
      await this.loadDetail()
    } catch (error) {
      const err = error as { errMsg?: string }
      const errMsg = err && err.errMsg ? String(err.errMsg) : ''
      if (errMsg.indexOf('cancel') >= 0) {
        wx.showToast({ title: '你已取消支付，可稍后继续', icon: 'none' })
      } else {
        wx.showToast({ title: '支付发起失败，请稍后重试', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
      this.setData({ paying: false })
    }
  },

  async onCancelOrderTap() {
    const order = this.data.order
    if (!order) return
    const status = String(order.status || '')
    if (status !== 'unpaid' && status !== 'unshipped') return

    try {
      const confirm = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '取消订单',
          content: '确认取消当前订单吗？',
          confirmText: '确认取消',
          cancelText: '再想想',
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false),
        })
      })
      if (!confirm) return

      wx.showLoading({ title: '处理中', mask: true })
      const resp = (await cancelMallOrder(String(order.orderNo || order.no || ''))) as Record<string, unknown>
      wx.hideLoading()
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '取消订单失败'), icon: 'none' })
        return
      }
      this.applyOrder((resp.data || null) as MallOrder | null)
      wx.showToast({ title: '订单已取消', icon: 'success' })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '取消订单失败', icon: 'none' })
    }
  },

  async onConfirmReceiveTap() {
    const order = this.data.order
    if (!order) return
    const status = String(order.status || '')
    if (status !== 'pending_review' && status !== 'unreceived') return

    try {
      const confirm = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '确认收货',
          content: '确认已经收到商品了吗？',
          confirmText: '确认收货',
          cancelText: '再等等',
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false),
        })
      })
      if (!confirm) return

      this.setData({ receiving: true })
      const resp = (await confirmMallOrderReceived(String(order.orderNo || order.no || ''))) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '确认收货失败'), icon: 'none' })
        return
      }
      this.applyOrder((resp.data || null) as MallOrder | null)
      wx.showToast({ title: '确认收货成功', icon: 'success' })
    } catch (_) {
      wx.showToast({ title: '确认收货失败', icon: 'none' })
    } finally {
      this.setData({ receiving: false })
    }
  },

  onOpenAfterSaleTap() {
    const order = this.data.order
    if (!order || String(order.status || '') !== 'pending_review') return
    this.setData({
      afterSaleVisible: true,
      afterSaleType: 'refund_only',
      afterSaleReason: '',
      afterSaleReasonCount: 0,
      afterSaleEvidenceImage: '',
    })
  },

  onCloseAfterSaleTap() {
    this.setData({
      afterSaleVisible: false,
      afterSaleSubmitting: false,
    })
  },

  onAfterSaleTypeChange(e: WechatMiniprogram.CustomEvent) {
    const value = String((e && e.detail && e.detail.value) || 'refund_only')
    this.setData({
      afterSaleType: value === 'return_refund' ? 'return_refund' : 'refund_only',
    })
  },

  onAfterSaleReasonInput(e: WechatMiniprogram.CustomEvent) {
    const value = String((e && e.detail && e.detail.value) || '').slice(0, 100)
    this.setData({ afterSaleReason: value, afterSaleReasonCount: value.length })
  },

  async onSubmitAfterSaleTap() {
    const order = this.data.order
    if (!order) return
    const reason = String(this.data.afterSaleReason || '').trim()
    if (!reason) {
      wx.showToast({ title: '请填写售后原因', icon: 'none' })
      return
    }
    if (reason.length > 100) {
      wx.showToast({ title: '售后原因不能超过100字', icon: 'none' })
      return
    }

    await requestSubscribeMessageForScenes(['aftersale_confirmed', 'aftersale_completed'])

    this.setData({ afterSaleSubmitting: true })
    try {
      const resp = (await createMallAfterSale({
        orderNo: String(order.orderNo || order.no || ''),
        type: this.data.afterSaleType === 'return_refund' ? 'return_refund' : 'refund_only',
        reason,
        evidenceImage: String(this.data.afterSaleEvidenceImage || ''),
      })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '提交售后失败'), icon: 'none' })
        return
      }
      this.setData({
        afterSaleVisible: false,
        afterSaleReason: '',
        afterSaleReasonCount: 0,
        afterSaleEvidenceImage: '',
      })
      this.applyOrder((resp.data || null) as MallOrder | null)
      wx.showToast({ title: '售后申请已提交', icon: 'success' })
    } catch (_) {
      wx.showToast({ title: '提交售后失败', icon: 'none' })
    } finally {
      this.setData({ afterSaleSubmitting: false })
    }
  },

  onReviewTap() {
    const order = this.data.order
    if (!order || String(order.status || '') !== 'pending_review') return
    this.setData({
      reviewVisible: true,
      reviewScore: 5,
      reviewContent: '',
      reviewContentCount: 0,
      reviewImages: [],
    })
  },

  onCloseReviewTap() {
    this.setData({
      reviewVisible: false,
      reviewSubmitting: false,
    })
  },

  onReviewScoreTap(e: WechatMiniprogram.TouchEvent) {
    const score = Number((e.currentTarget.dataset as { score?: number }).score || 5)
    if (score < 1 || score > 5) return
    this.setData({ reviewScore: score })
  },

  onReviewContentInput(e: WechatMiniprogram.CustomEvent) {
    const value = String((e && e.detail && e.detail.value) || '').slice(0, 100)
    this.setData({ reviewContent: value, reviewContentCount: value.length })
  },

  async onChooseReviewImageTap() {
    const current = Array.isArray(this.data.reviewImages) ? this.data.reviewImages : []
    if (current.length >= 3) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }
    try {
      const chooseRes = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: 3 - current.length,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })
      const tempFiles = chooseRes && chooseRes.tempFiles ? chooseRes.tempFiles : []
      if (!tempFiles.length) return
      wx.showLoading({ title: '上传中', mask: true })
      const nextImages = [...current]
      for (let i = 0; i < tempFiles.length; i += 1) {
        const filePath = String((tempFiles[i] && tempFiles[i].tempFilePath) || '')
        if (!filePath) continue
        const resp = (await uploadMallReviewImage(filePath)) as Record<string, unknown>
        if (Number(resp.code) !== 200) {
          wx.hideLoading()
          wx.showToast({ title: String(resp.msg || '评价图片上传失败'), icon: 'none' })
          return
        }
        const data = (resp.data || {}) as Record<string, unknown>
        const url = String(data.url || '')
        if (url) nextImages.push(url)
      }
      wx.hideLoading()
      this.setData({ reviewImages: nextImages.slice(0, 3) })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '评价图片上传失败', icon: 'none' })
    }
  },

  onRemoveReviewImageTap(e: WechatMiniprogram.TouchEvent) {
    const index = Number((e.currentTarget.dataset as { index?: number }).index)
    const current = Array.isArray(this.data.reviewImages) ? [...this.data.reviewImages] : []
    if (index < 0 || index >= current.length) return
    current.splice(index, 1)
    this.setData({ reviewImages: current })
  },

  async onSubmitReviewTap() {
    const order = this.data.order
    if (!order) return
    const content = String(this.data.reviewContent || '').trim()
    const score = Number(this.data.reviewScore || 0)
    const images = Array.isArray(this.data.reviewImages) ? this.data.reviewImages : []
    if (score < 1 || score > 5) {
      wx.showToast({ title: '请选择评分', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '请填写评价内容', icon: 'none' })
      return
    }
      if (content.length > 100) {
        wx.showToast({ title: '评价内容不能超过100字', icon: 'none' })
        return
      }
    if (images.length > 3) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }

    this.setData({ reviewSubmitting: true })
    try {
      const resp = (await createMallOrderReview({
        orderNo: String(order.orderNo || order.no || ''),
        score,
        content,
        images,
      })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '提交评价失败'), icon: 'none' })
        return
      }
      this.setData({
        reviewVisible: false,
        reviewScore: 5,
        reviewContent: '',
        reviewContentCount: 0,
        reviewImages: [],
      })
      this.applyOrder((resp.data || null) as MallOrder | null)
      wx.showToast({ title: '评价提交成功', icon: 'success' })
    } catch (_) {
      wx.showToast({ title: '提交评价失败', icon: 'none' })
    } finally {
      this.setData({ reviewSubmitting: false })
    }
  },

  async onChooseAfterSaleEvidenceTap() {
    try {
      const chooseRes = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })
      const tempFiles = chooseRes && chooseRes.tempFiles ? chooseRes.tempFiles : []
      const firstFile = tempFiles && tempFiles.length ? tempFiles[0] : null
      const filePath = String((firstFile && firstFile.tempFilePath) || '')
      if (!filePath) return

      wx.showLoading({ title: '上传中', mask: true })
      const resp = (await uploadMallAfterSaleEvidence(filePath)) as Record<string, unknown>
      wx.hideLoading()
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '上传凭证失败'), icon: 'none' })
        return
      }
      const data = (resp.data || {}) as Record<string, unknown>
      this.setData({ afterSaleEvidenceImage: String(data.url || '') })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '上传凭证失败', icon: 'none' })
    }
  },

  onRemoveAfterSaleEvidenceTap() {
    this.setData({ afterSaleEvidenceImage: '' })
  },

  onOpenReturnTap() {
    const order = this.data.order
    const afterSale = order && order.afterSale ? order.afterSale : null
    if (!afterSale || String(afterSale.status || '') !== 'approved') return
    const currentCompany = String(afterSale.returnExpressCompany || '')
    const companyNames = Array.isArray(this.data.returnExpressCompanyNames) ? this.data.returnExpressCompanyNames : []
    const currentIndex = currentCompany ? companyNames.indexOf(currentCompany) : -1
    this.setData({
      returnVisible: true,
      returnExpressCompany: currentCompany,
      returnExpressCompanyIndex: currentIndex >= 0 ? currentIndex : 0,
      returnExpressNo: String(afterSale.returnExpressNo || ''),
    })
  },

  onCloseReturnTap() {
    this.setData({
      returnVisible: false,
      returnSubmitting: false,
    })
  },

  onReturnCompanyChange(e: WechatMiniprogram.CustomEvent) {
    const rawValue = (e && e.detail && e.detail.value) || -1
    const index = Number(rawValue)
    const names = Array.isArray(this.data.returnExpressCompanyNames) ? this.data.returnExpressCompanyNames : []
    const value = index >= 0 && index < names.length ? String(names[index] || '') : ''
    this.setData({
      returnExpressCompanyIndex: index,
      returnExpressCompany: value,
    })
  },

  onReturnNoInput(e: WechatMiniprogram.CustomEvent) {
    const value = String((e && e.detail && e.detail.value) || '')
    this.setData({ returnExpressNo: value })
  },

  onCopyReturnInfoTap() {
    const receiverName = String(this.data.returnReceiverName || '')
    const receiverPhone = String(this.data.returnReceiverPhone || '')
    const receiverAddress = String(this.data.returnReceiverAddress || '')
    const parts = [] as string[]
    if (receiverName) parts.push(`收货人：${receiverName}`)
    if (receiverPhone) parts.push(`联系电话：${receiverPhone}`)
    if (receiverAddress) parts.push(`收货地址：${receiverAddress}`)
    const text = parts.join('\n')
    if (!text) {
      wx.showToast({ title: '暂无可复制信息', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '信息已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
    })
  },

  async onSubmitReturnTap() {
    const order = this.data.order
    if (!order) return
    const expressCompany = String(this.data.returnExpressCompany || '').trim()
    const expressNo = String(this.data.returnExpressNo || '').trim()
    if (!expressCompany) {
      wx.showToast({ title: '请选择物流公司', icon: 'none' })
      return
    }
    if (!expressNo) {
      wx.showToast({ title: '请输入物流单号', icon: 'none' })
      return
    }

    this.setData({ returnSubmitting: true })
    try {
      const resp = (await submitMallAfterSaleReturn({
        orderNo: String(order.orderNo || order.no || ''),
        expressCompany,
        expressNo,
      })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '提交退货物流失败'), icon: 'none' })
        return
      }
      this.setData({ returnVisible: false })
      this.applyOrder((resp.data || null) as MallOrder | null)
      wx.showToast({ title: '退货物流已提交', icon: 'success' })
    } catch (_) {
      wx.showToast({ title: '提交退货物流失败', icon: 'none' })
    } finally {
      this.setData({ returnSubmitting: false })
    }
  },

  onViewProduct() {
    const order = this.data.order
    if (!order || !order.productId) return
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${order.productId}`,
    })
  },
})
