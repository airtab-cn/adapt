export const USER_BASE_URL = 'http://192.168.3.37:8000/user/'
export const MINI_TOKEN_KEY = 'miniToken'
export const MINI_PROFILE_KEY = 'miniProfile'

type AnyObject = Record<string, unknown>
type SubscribeSceneCode =
  | 'mall_paid'
  | 'mall_shipped'
  | 'mall_completed'
  | 'aftersale_confirmed'
  | 'aftersale_completed'
  | 'adopt_confirmed'
  | 'adopt_gift_shipped'
  | 'reservation_approved'

function getMiniToken() {
  try {
    return String(wx.getStorageSync(MINI_TOKEN_KEY) || '')
  } catch (_) {
    return ''
  }
}

export function hasMiniLogin() {
  return !!getMiniToken()
}

function setMiniToken(token: string) {
  try {
    wx.setStorageSync(MINI_TOKEN_KEY, token || '')
  } catch (_) {
    /* ignore */
  }
}

function setMiniProfile(profile: Record<string, unknown>) {
  try {
    wx.setStorageSync(MINI_PROFILE_KEY, profile || {})
  } catch (_) {
    /* ignore */
  }
}

export function clearMiniAuth() {
  try {
    wx.removeStorageSync(MINI_TOKEN_KEY)
  } catch (_) {
    /* ignore */
  }
  try {
    wx.removeStorageSync(MINI_PROFILE_KEY)
  } catch (_) {
    /* ignore */
  }
}

function request<T = AnyObject>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  data?: AnyObject,
  needAuth = false
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getMiniToken()
    const headers: Record<string, string> = {}
    if (needAuth && token) {
      headers.Authorization = `Bearer ${token}`
    }

    wx.request({
      url: `${USER_BASE_URL}${path}`,
      method,
      data,
      header: headers,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        reject(new Error(`HTTP ${res.statusCode}`))
      },
      fail: (err) => reject(err),
    })
  })
}

export function wxLogin(code: string) {
  return request('wxLogin/', 'POST', { code })
}

export function ensureMiniLogin(force = false): Promise<string> {
  const cached = getMiniToken()
  if (cached && !force) {
    return Promise.resolve(cached)
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        try {
          const code = String(res.code || '')
          if (!code) {
            reject(new Error('缺少登录code'))
            return
          }
          const loginResp = (await wxLogin(code)) as Record<string, unknown>
          if (Number(loginResp.code) !== 200) {
            reject(new Error(String(loginResp.msg || '登录失败')))
            return
          }
          const token = String(loginResp.token || '')
          if (!token) {
            reject(new Error('缂哄皯token'))
            return
          }
          setMiniToken(token)
          const source = ((loginResp && loginResp.data) || loginResp) as Record<string, unknown>
          const profile = ((source && source.data) || source) as Record<string, unknown>
          setMiniProfile(profile)
          resolve(token)
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function getUserProfile() {
  return requestWithAuthRetry('getUserProfile/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function updateUserProfile(data: { nickname?: string; avatar?: string }) {
  return requestWithAuthRetry('updateUserProfile/', 'POST', data, {
    allowReloginWhenRejected: true,
  })
}

export async function getSubscribeMessageTemplates(sceneCodes: string[]) {
  const sceneText = sceneCodes.map((item) => encodeURIComponent(String(item || ''))).filter(Boolean).join(',')
  return requestWithAuthRetry(`getSubscribeMessageTemplates/?sceneCodes=${sceneText}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function saveSubscribeMessageAuth(data: {
  sceneCodes: string[]
  templateIds: string[]
  result: Record<string, unknown>
}) {
  return requestWithAuthRetry('saveSubscribeMessageAuth/', 'POST', data as unknown as AnyObject, {
    allowReloginWhenRejected: true,
  })
}

export async function requestSubscribeMessageForScenes(sceneCodes: SubscribeSceneCode[]) {
  try {
    if (!sceneCodes || !sceneCodes.length) return
    const resp = (await getSubscribeMessageTemplates(sceneCodes)) as Record<string, unknown>
    if (Number(resp.code) !== 200) return
    const list = Array.isArray(resp.data) ? resp.data : []
    const tmplIds: string[] = []
    const hitScenes: string[] = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as Record<string, unknown>
      const templateId = String(item.templateId || item.template_id || '').trim()
      const sceneCode = String(item.sceneCode || item.scene_code || '').trim()
      if (templateId && tmplIds.indexOf(templateId) < 0) {
        tmplIds.push(templateId)
        hitScenes.push(sceneCode)
      }
      if (tmplIds.length >= 3) break
    }
    if (!tmplIds.length || typeof wx.requestSubscribeMessage !== 'function') return
    const result = await new Promise<Record<string, unknown>>((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds,
        success: (res) => resolve((res || {}) as unknown as Record<string, unknown>),
        fail: (err) => resolve({ errMsg: err && err.errMsg ? err.errMsg : 'requestSubscribeMessage fail' }),
      })
    })
    await saveSubscribeMessageAuth({ sceneCodes: hitScenes, templateIds: tmplIds, result })
  } catch (error) {
    console.warn('request subscribe message skipped:', error)
  }
}

export async function uploadAvatar(filePath: string): Promise<Record<string, unknown>> {
  await ensureMiniLogin()
  const token = getMiniToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${USER_BASE_URL}uploadAvatar/`,
      filePath,
      name: 'avatar',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}') as Record<string, unknown>
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export function getBaseInfo() {
  return request('getBaseInfo/')
}

export function getExpressCompanyOptions() {
  return request('getExpressCompanyOptions/')
}


export function getMonitorAreas() {
  return request('getMonitorAreas/')
}

export function getMonitorCameras(areaId?: string | number) {
  const hasArea = areaId !== undefined && areaId !== null && String(areaId) !== '' && String(areaId) !== 'all'
  return request(`getMonitorCameras/${hasArea ? `?areaId=${areaId}` : ''}`)
}

export function getMonitorPlayInfo(cameraId: string | number, areaId?: string | number) {
  const areaQuery = areaId === undefined || areaId === null || String(areaId) === '' ? '' : `&areaId=${areaId}`
  return request(`getMonitorPlayInfo/?id=${cameraId}${areaQuery}`)
}

export function getHomeBanners() {
  return request('getHomeBanners/')
}

export function getHomeNotices() {
  return request('getHomeNotices/')
}

export function getHomeActivities() {
  return request('getHomeActivities/')
}

export function getHomeActivityDetail(id: number | string) {
  return request(`getHomeActivityDetail/?id=${id}`)
}

export function getActivityMessages(activityId?: number, page?: number, pageSize?: number) {
  const query: string[] = []
  if (activityId) query.push(`activityId=${activityId}`)
  if (page) query.push(`page=${page}`)
  if (pageSize) query.push(`pageSize=${pageSize}`)
  const path = `getActivityMessages/${query.length ? `?${query.join('&')}` : ''}`
  return request(path)
}

export async function createActivityMessage(data: { activityId: number | string; content: string }) {
  return requestWithAuthRetry('createActivityMessage/', 'POST', data, {
    allowReloginWhenRejected: true,
  })
}

export async function createReservation(data: {
  visitTime: string
  people: number
  purpose: string
  contactName: string
  phone: string
}) {
  await ensureMiniLogin()
  let resp = (await request('createReservation/', 'POST', data, true)) as Record<string, unknown>
  if (Number(resp.code) === 401) {
    clearMiniAuth()
    await ensureMiniLogin()
    resp = (await request('createReservation/', 'POST', data, true)) as Record<string, unknown>
  }
  return resp
}

export function getReservationRecords(page = 1, pageSize = 10) {
  return requestWithAuthRetry(`getReservationRecords/?page=${page}&pageSize=${pageSize}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

type AddressPayload = {
  id?: number | string
  receiverName?: string
  receiver_name?: string
  name?: string
  phone?: string
  province?: string
  city?: string
  district?: string
  region?: string
  detail?: string
  isDefault?: boolean
  is_default?: boolean
}

async function requestWithAuthRetry(
  path: string,
  method: 'GET' | 'POST',
  data?: AnyObject,
  options?: { allowReloginWhenRejected?: boolean }
) {
  await ensureMiniLogin()
  let resp = (await request(path, method, data, true)) as Record<string, unknown>
  const firstCode = Number(resp.code)
  const firstMsg = String(resp.msg || '')
  const firstMsgLower = firstMsg.toLowerCase()
  const needRetry =
    firstCode === 401 ||
    firstMsg.includes('用户不存在') ||
    firstMsg.includes('登录') ||
    firstMsg.includes('未登录') ||
    firstMsgLower.includes('token')
  const allowReloginWhenRejected = !!(options && options.allowReloginWhenRejected)
  if (needRetry && (allowReloginWhenRejected || firstCode === 401)) {
    clearMiniAuth()
    await ensureMiniLogin(true)
    resp = (await request(path, method, data, true)) as Record<string, unknown>
  } else if (needRetry) {
    clearMiniAuth()
  }
  return resp
}

export async function getAddressList() {
  return requestWithAuthRetry('getAddressList/', 'GET', undefined, { allowReloginWhenRejected: true })
}

export async function createAddress(data: AddressPayload) {
  return requestWithAuthRetry('createAddress/', 'POST', data as AnyObject, { allowReloginWhenRejected: true })
}

export async function updateAddress(data: AddressPayload) {
  return requestWithAuthRetry('updateAddress/', 'POST', data as AnyObject, { allowReloginWhenRejected: true })
}

export async function deleteAddress(id: number | string) {
  return requestWithAuthRetry('deleteAddress/', 'POST', { id }, { allowReloginWhenRejected: true })
}

export function getMallCategories() {
  return request('getMallCategories/')
}

export function getMallProducts(params?: { categoryId?: number | string; keyword?: string; tag?: string }) {
  const query: string[] = []
  if (params) {
    if (params.categoryId) query.push(`categoryId=${params.categoryId}`)
    if (params.keyword) query.push(`keyword=${encodeURIComponent(String(params.keyword))}`)
    if (params.tag) query.push(`tag=${encodeURIComponent(String(params.tag))}`)
  }
  const path = `getMallProducts/${query.length ? `?${query.join('&')}` : ''}`
  return request(path)
}

export function getMallProductDetail(id: number | string, withAuth = false) {
  return request(`getMallProductDetail/?id=${id}`, 'GET', undefined, withAuth)
}

export async function toggleProductFavorite(productId: number | string) {
  return requestWithAuthRetry('toggleProductFavorite/', 'POST', { productId }, { allowReloginWhenRejected: true })
}

export async function getFavoriteProducts(page = 1, pageSize = 10) {
  return requestWithAuthRetry(`getFavoriteProducts/?page=${page}&pageSize=${pageSize}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

const CART_STORAGE_KEY = 'gegeda_cart_v1'

export interface CartItemDTO {
  id: string
  productId: string
  skuName: string
  title: string
  img: string
  price: string
  originPrice: string
  quantity: number
  selected: boolean
  deliveryMode?: string
  shippingFee?: string
}

type AddCartPayload = {
  productId: string | number
  skuName: string
  title: string
  img: string
  price: string | number
  originPrice?: string | number
  quantity: number
  deliveryMode?: string
  shippingFee?: string | number
}

function parsePriceText(value: unknown): string {
  const n = Number(value)
  if (Number.isNaN(n) || n < 0) return '0.00'
  return n.toFixed(2)
}

function loadCartLocal(): CartItemDTO[] {
  try {
    const raw = wx.getStorageSync(CART_STORAGE_KEY) as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((x) => x && typeof x === 'object')
      .map((x: Record<string, unknown>) => ({
        id: String(x.id || ''),
        productId: String(x.productId || ''),
        skuName: String(x.skuName || ''),
        title: String(x.title || ''),
        img: String(x.img || ''),
        price: parsePriceText(x.price),
        originPrice: parsePriceText(x.originPrice || x.price),
        quantity: Math.max(1, Math.floor(Number(x.quantity) || 1)),
        selected: x.selected !== false,
        deliveryMode: String(x.deliveryMode || ''),
        shippingFee: parsePriceText(x.shippingFee || 0),
      }))
      .filter((x) => !!x.id)
      .filter((x) => !x.id.startsWith('demo_'))
      .filter((x) => !x.productId.startsWith('demo_'))
  } catch (_) {
    return []
  }
}

function saveCartLocal(list: CartItemDTO[]) {
  try {
    wx.setStorageSync(CART_STORAGE_KEY, list)
  } catch (_) {
    /* ignore */
  }
}

function cartItemId(productId: string | number, skuName: string, deliveryMode = '') {
  return `${String(productId)}__${String(skuName || '默认规格')}__${String(deliveryMode || '')}`
}

export async function getCartItems() {
  try {
    const resp = (await requestWithAuthRetry('getCartList/', 'GET', undefined, {
      allowReloginWhenRejected: true,
    })) as Record<string, unknown>
    if (Number(resp.code) === 200 && Array.isArray(resp.data)) {
      const remote = (resp.data as unknown[]).map((row) => {
        const item = (row || {}) as Record<string, unknown>
        return {
          id: String(item.id || cartItemId(String(item.productId || item.product_id || ''), String(item.skuName || item.sku_name || '默认规格'), String(item.deliveryMode || item.delivery_mode || ''))),
          productId: String(item.productId || item.product_id || ''),
          skuName: String(item.skuName || item.sku_name || '默认规格'),
          title: String(item.title || item.name || ''),
          img: String(item.img || item.cover || ''),
          price: parsePriceText(item.price),
          originPrice: parsePriceText(item.originPrice || item.origin_price || item.price),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          selected: item.selected !== false,
          deliveryMode: String(item.deliveryMode || item.delivery_mode || ''),
          shippingFee: parsePriceText(item.shippingFee || item.shipping_fee || 0),
        } as CartItemDTO
      })
      saveCartLocal(remote)
      return { code: 200, data: remote, msg: 'ok' }
    }
  } catch (_) {
    // fallback local
  }
  const local = loadCartLocal()
  saveCartLocal(local)
  return { code: 200, data: local, msg: 'ok(local)' }
}

export async function addCartItem(payload: AddCartPayload) {
  const id = cartItemId(payload.productId, payload.skuName, String(payload.deliveryMode || ''))
  const local = loadCartLocal()
  const idx = local.findIndex((x) => x.id === id)
  if (idx >= 0) {
    local[idx] = {
      ...local[idx],
      quantity: local[idx].quantity + Math.max(1, Math.floor(Number(payload.quantity) || 1)),
      price: parsePriceText(payload.price),
      originPrice: parsePriceText(payload.originPrice != null ? payload.originPrice : payload.price),
      selected: true,
      deliveryMode: String(payload.deliveryMode || ''),
      shippingFee: parsePriceText(payload.shippingFee || 0),
    }
  } else {
    local.unshift({
      id,
      productId: String(payload.productId),
      skuName: String(payload.skuName || '默认规格'),
      title: String(payload.title || ''),
      img: String(payload.img || ''),
      price: parsePriceText(payload.price),
      originPrice: parsePriceText(payload.originPrice != null ? payload.originPrice : payload.price),
      quantity: Math.max(1, Math.floor(Number(payload.quantity) || 1)),
      selected: true,
      deliveryMode: String(payload.deliveryMode || ''),
      shippingFee: parsePriceText(payload.shippingFee || 0),
    })
  }
  saveCartLocal(local)

  try {
    const resp = (await requestWithAuthRetry('addCartItem/', 'POST', {
      productId: payload.productId,
      skuName: payload.skuName,
      quantity: payload.quantity,
      deliveryMode: payload.deliveryMode,
    }, { allowReloginWhenRejected: true })) as Record<string, unknown>
    if (Number(resp.code) === 200) return resp
    return resp
  } catch (error) {
    console.warn('add cart item failed:', error)
  }
  return { code: 500, data: local, msg: '加入购物车失败，请稍后重试' }
}

export async function updateCartItem(payload: { id: string; quantity?: number; selected?: boolean }) {
  const local = loadCartLocal()
  const idx = local.findIndex((x) => x.id === payload.id)
  if (idx < 0) return { code: 404, msg: '购物车项不存在' }
  const nextQty = payload.quantity == null ? local[idx].quantity : Math.max(1, Math.floor(Number(payload.quantity) || 1))
  local[idx] = {
    ...local[idx],
    quantity: nextQty,
    selected: payload.selected == null ? local[idx].selected : !!payload.selected,
  }
  saveCartLocal(local)
  try {
    const resp = (await requestWithAuthRetry(
      'updateCartItem/',
      'POST',
      payload as unknown as AnyObject,
      { allowReloginWhenRejected: true }
    )) as Record<string, unknown>
    if (Number(resp.code) === 200) return resp
  } catch (_) {
    // fallback local
  }
  return { code: 200, data: local[idx], msg: 'ok(local)' }
}

export async function deleteCartItem(id: string) {
  const local = loadCartLocal().filter((x) => x.id !== id)
  saveCartLocal(local)
  try {
    const resp = (await requestWithAuthRetry('deleteCartItem/', 'POST', { id }, {
      allowReloginWhenRejected: true,
    })) as Record<string, unknown>
    if (Number(resp.code) === 200) return resp
  } catch (_) {
    // fallback local
  }
  return { code: 200, data: local, msg: 'ok(local)' }
}

const BUY_NOW_DRAFT_KEY = 'gegeda_buy_now_draft_v1'
const ORDER_STORAGE_KEY = 'gegeda_order_list_v1'

export interface BuyNowDraftItem {
  cartItemId?: string | number
  productId: string
  skuName: string
  title: string
  img: string
  price: string
  originPrice: string
  quantity: number
  deliveryMode?: string
  shippingFee?: string
}

export interface BuyNowDraft {
  productId: string
  skuName: string
  title: string
  img: string
  price: string
  originPrice: string
  quantity: number
  deliveryMode?: string
  shippingFee?: string
  items?: BuyNowDraftItem[]
  cartItemIds?: Array<string | number>
}

export interface CouponRuleItem {
  id: number | string
  name: string
  couponType: string
  couponTypeText: string
  issueMode: string
  scene: string
  sceneText: string
  amount: string
  thresholdAmount: string
  validDays: number
  totalCount: number
  issuedCount: number
  remainCount: number
  hasClaimed?: boolean
  isEnabled?: boolean
  description?: string
}

export interface UserCouponItem {
  id: number | string
  couponNo: string
  name: string
  couponType: string
  couponTypeText: string
  scene: string
  sceneText: string
  amount: string
  thresholdAmount: string
  status: string
  statusText: string
  source: string
  claimedTime: string
  expireTime: string
  isExpired: boolean
}

export interface CouponStats {
  total: number
  unused: number
  mallUnused: number
  adoptUnused: number
}

export interface PointStats {
  totalPoints: number
  totalRecords: number
}

export interface PointRecordItem {
  id: number | string
  changeType: string
  changeTypeText: string
  points: number
  balanceAfter: number
  source: string
  remark: string
  orderNo?: string
  createTime: string
}

export interface BalanceRechargePackageItem {
  id: number | string
  name: string
  actualAmount: string
  payAmount: string
  description?: string
}

export interface BalanceRechargeRecordItem {
  id: number | string
  rechargeNo: string
  packageName: string
  actualAmount: string
  payAmount: string
  status: string
  statusText: string
  paymentMethod?: string
  wxTransactionId?: string
  remark?: string
  paidTime?: string
  createTime: string
}

export type MallOrderStatus =
  | 'unpaid'
  | 'unshipped'
  | 'unreceived'
  | 'pending_review'
  | 'completed'
  | 'closed'
  | 'aftersale'
  | 'returning'
  | 'pending_refund'
  | 'aftersale_done'
  | 'refunding'
  | 'refunded'

export interface MallAfterSale {
  id: string | number
  afterSaleNo?: string
  type: 'refund_only' | 'return_refund' | string
  typeText?: string
  status: 'pending' | 'approved' | 'rejected' | 'returning' | 'pending_refund' | 'completed' | string
  statusText?: string
  reason: string
  evidenceImage?: string
  adminRemark?: string
  rejectReason?: string
  returnExpressCompany?: string
  returnExpressNo?: string
  returnExpressStatus?: string
  returnExpressStatusDesc?: string
  returnExpressLastContext?: string
  returnExpressLastTime?: string
  returnExpressLastQueryTime?: string
  returnExpressTracks?: Array<{ time?: string; context?: string }>
  returnShipTime?: string
  reviewTime?: string
  completeTime?: string
  createTime?: string
  updateTime?: string
}

export interface MallOrderReview {
  id: string | number
  score: number
  content: string
  images?: string[]
  nickname?: string
  avatar?: string
  userUid?: string
  createTime?: string
  updateTime?: string
}

export interface MallOrderItem {
  productId?: string | number
  product_id?: string | number
  goodsNo?: string
  goods_no?: string
  title: string
  cover?: string
  img?: string
  skuName?: string
  sku_name?: string
  deliveryMode?: string
  delivery_mode?: string
  quantity?: number
  qty?: number
  unitPrice?: string
  unit_price?: string
  goodsAmount?: string
  goods_amount?: string
  shippingFee?: string
  shipping_fee?: string
}

export interface MallOrder {
  id: string | number
  no: string
  orderNo?: string
  status: MallOrderStatus
  statusText: string
  productId: string
  title: string
  cover: string
  specs: string
  deliveryMode?: string
  qty: number
  quantity?: number
  time: string
  amount: string
  goodsAmount?: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  shippingFee?: string
  payAmount?: string
  balanceAmount?: string
  wechatAmount?: string
  refundedBalanceAmount?: string
  refundedWechatAmount?: string
  couponTitle?: string
  couponAmount?: string
  coupon?: UserCouponItem | null
  createTime?: string
  payTime?: string
  expressCompany?: string
  expressNo?: string
  expressStatus?: string
  expressStatusDesc?: string
  expressLastContext?: string
  expressLastTime?: string
  expressLastQueryTime?: string
  expressTracks?: Array<{ time?: string; context?: string }>
  shipRemark?: string
  wxTransactionId?: string
  paymentMethod?: string
  payStatus?: string
  userUid?: string
  invoice?: Record<string, unknown> | null
  shippedTime?: string
  updateTime?: string
  afterSale?: MallAfterSale | null
  review?: MallOrderReview | null
  items?: MallOrderItem[]
  orderItems?: MallOrderItem[]
  itemCount?: number
}

export interface ProductReviewItem {
  id: string | number
  score: number
  content: string
  images?: string[]
  nickname?: string
  avatar?: string
  createTime?: string
  userUid?: string
}

function loadOrderLocal(): MallOrder[] {
  try {
    const raw = wx.getStorageSync(ORDER_STORAGE_KEY) as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as MallOrder)
      .filter((x) => !!x.id && !!x.no)
  } catch (_) {
    return []
  }
}

function saveOrderLocal(list: MallOrder[]) {
  try {
    wx.setStorageSync(ORDER_STORAGE_KEY, list)
  } catch (_) {
    /* ignore */
  }
}

export function setBuyNowDraft(draft: BuyNowDraft) {
  try {
    wx.setStorageSync(BUY_NOW_DRAFT_KEY, draft)
  } catch (_) {
    /* ignore */
  }
}

export function getBuyNowDraft(): BuyNowDraft | null {
  try {
    const row = wx.getStorageSync(BUY_NOW_DRAFT_KEY) as unknown
    if (!row || typeof row !== 'object') return null
    const obj = row as Record<string, unknown>
    return {
      productId: String(obj.productId || ''),
      skuName: String(obj.skuName || '默认规格'),
      title: String(obj.title || ''),
      img: String(obj.img || ''),
      price: parsePriceText(obj.price),
      originPrice: parsePriceText(obj.originPrice || obj.price),
      quantity: Math.max(1, Math.floor(Number(obj.quantity) || 1)),
      deliveryMode: String(obj.deliveryMode || ''),
      shippingFee: parsePriceText(obj.shippingFee || 0),
      items: Array.isArray(obj.items)
        ? (obj.items as unknown[])
            .filter((x) => x && typeof x === 'object')
            .map((x) => {
              const row = x as Record<string, unknown>
              return {
                cartItemId: (row.cartItemId || row.cart_item_id || '') as string | number,
                productId: String(row.productId || row.product_id || ''),
                skuName: String(row.skuName || row.sku_name || '默认规格'),
                title: String(row.title || ''),
                img: String(row.img || row.cover || ''),
                price: parsePriceText(row.price || row.unitPrice || row.unit_price || 0),
                originPrice: parsePriceText(row.originPrice || row.origin_price || row.price || 0),
                quantity: Math.max(1, Math.floor(Number(row.quantity || row.qty) || 1)),
                deliveryMode: String(row.deliveryMode || row.delivery_mode || ''),
                shippingFee: parsePriceText(row.shippingFee || row.shipping_fee || 0),
              }
            })
            .filter((x) => !!x.productId)
        : undefined,
      cartItemIds: Array.isArray(obj.cartItemIds) ? (obj.cartItemIds as Array<string | number>) : undefined,
    }
  } catch (_) {
    return null
  }
}

export function clearBuyNowDraft() {
  try {
    wx.removeStorageSync(BUY_NOW_DRAFT_KEY)
  } catch (_) {
    /* ignore */
  }
}

function nowOrderNo() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const his = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `M${ymd}${his}${Math.floor(Math.random() * 90 + 10)}`
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function createMallOrder(data: {
  draft: BuyNowDraft
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  paymentMethod?: string
  invoice?: Record<string, unknown> | null
  buyerRemark?: string
  couponId?: string | number
}) {
  return requestWithAuthRetry('createMallOrder/', 'POST', {
    productId: data.draft.productId,
    skuName: data.draft.skuName,
    quantity: data.draft.quantity,
    deliveryMode: data.draft.deliveryMode,
    items: data.draft.items || [],
    paymentMethod: data.paymentMethod,
    invoice: data.invoice || null,
    buyerRemark: data.buyerRemark || '',
    receiverName: data.receiverName,
    receiverPhone: data.receiverPhone,
    receiverAddress: data.receiverAddress,
    couponId: data.couponId || 0,
  }, { allowReloginWhenRejected: false })
}

export async function confirmMallOrderPaid(orderNo: string) {
  return requestWithAuthRetry('confirmMallOrderPaid/', 'POST', { orderNo }, { allowReloginWhenRejected: false })
}

export async function repayMallOrder(orderNo: string) {
  return requestWithAuthRetry('repayMallOrder/', 'POST', { orderNo }, { allowReloginWhenRejected: false })
}

export async function cancelMallOrder(orderNo: string) {
  return requestWithAuthRetry('cancelMallOrder/', 'POST', { orderNo }, { allowReloginWhenRejected: false })
}

export async function getMallOrderList(status?: string) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
  return requestWithAuthRetry(`getMallOrderList/${query}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getMallOrderDetail(orderNo: string) {
  const query = `?orderNo=${encodeURIComponent(orderNo)}`
  return requestWithAuthRetry(`getMallOrderDetail/${query}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function confirmMallOrderReceived(orderNo: string) {
  return requestWithAuthRetry('confirmMallOrderReceived/', 'POST', { orderNo }, {
    allowReloginWhenRejected: false,
  })
}

export async function createMallAfterSale(data: {
  orderNo: string
  type: 'refund_only' | 'return_refund'
  reason: string
  evidenceImage?: string
}) {
  return requestWithAuthRetry('createMallAfterSale/', 'POST', data as unknown as AnyObject, {
    allowReloginWhenRejected: false,
  })
}

export async function uploadMallReviewImage(filePath: string): Promise<Record<string, unknown>> {
  await ensureMiniLogin()
  const token = getMiniToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${USER_BASE_URL}uploadMallReviewImage/`,
      filePath,
      name: 'image',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}') as Record<string, unknown>
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function createMallOrderReview(data: {
  orderNo: string
  score: number
  content: string
  images?: string[]
}) {
  return requestWithAuthRetry('createMallOrderReview/', 'POST', data as unknown as AnyObject, {
    allowReloginWhenRejected: false,
  })
}

export async function uploadMallAfterSaleEvidence(filePath: string): Promise<Record<string, unknown>> {
  await ensureMiniLogin()
  const token = getMiniToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${USER_BASE_URL}uploadMallAfterSaleEvidence/`,
      filePath,
      name: 'image',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}') as Record<string, unknown>
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function submitMallAfterSaleReturn(data: {
  orderNo: string
  expressCompany: string
  expressNo: string
}) {
  return requestWithAuthRetry('submitMallAfterSaleReturn/', 'POST', data as unknown as AnyObject, {
    allowReloginWhenRejected: false,
  })
}

export function getMallProductReviews(id: number | string, page = 1, pageSize = 10) {
  return request(
    `getMallProductReviews/?id=${encodeURIComponent(String(id))}&page=${page}&pageSize=${pageSize}`
  )
}

export async function getCouponCenterList(scene = 'mall') {
  return requestWithAuthRetry(`getCouponCenterList/?scene=${encodeURIComponent(scene)}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function claimCoupon(id: string | number) {
  return requestWithAuthRetry('claimCoupon/', 'POST', { id }, {
    allowReloginWhenRejected: true,
  })
}

export async function getMyCouponList(params?: {
  scene?: string
  status?: string
  orderAmount?: string | number
  page?: number
  pageSize?: number
}) {
  const query: string[] = []
  const scene = params && params.scene ? String(params.scene) : ''
  const status = params && params.status ? String(params.status) : ''
  const orderAmount = params && params.orderAmount != null ? String(params.orderAmount) : ''
  const page = params && params.page ? params.page : 1
  const pageSize = params && params.pageSize ? params.pageSize : 10
  if (scene) query.push(`scene=${encodeURIComponent(scene)}`)
  if (status) query.push(`status=${encodeURIComponent(status)}`)
  if (orderAmount) query.push(`orderAmount=${encodeURIComponent(orderAmount)}`)
  query.push(`page=${page}`)
  query.push(`pageSize=${pageSize}`)
  return requestWithAuthRetry(`getMyCouponList/?${query.join('&')}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getCouponStats() {
  return requestWithAuthRetry('getCouponStats/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getPointStats() {
  return requestWithAuthRetry('getPointStats/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getPointRecordList(params?: {
  changeType?: string
  page?: number
  pageSize?: number
}) {
  const query: string[] = []
  const changeType = params && params.changeType ? String(params.changeType) : ''
  const page = params && params.page ? params.page : 1
  const pageSize = params && params.pageSize ? params.pageSize : 10
  if (changeType) query.push(`changeType=${encodeURIComponent(changeType)}`)
  query.push(`page=${page}`)
  query.push(`pageSize=${pageSize}`)
  return requestWithAuthRetry(`getPointRecordList/?${query.join('&')}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getBalancePackageList() {
  return requestWithAuthRetry('getBalancePackageList/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getBalanceRechargeRecordList(params?: {
  page?: number
  pageSize?: number
}) {
  const query: string[] = []
  const page = params && params.page ? params.page : 1
  const pageSize = params && params.pageSize ? params.pageSize : 10
  query.push(`page=${page}`)
  query.push(`pageSize=${pageSize}`)
  return requestWithAuthRetry(`getBalanceRechargeRecordList/?${query.join('&')}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getBalanceStats() {
  return requestWithAuthRetry('getBalanceStats/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export function getAdoptCategories() {
  return request('getAdoptCategories/')
}

export function getAdoptProducts(
  categoryId?: string | number,
  options?: { tag?: string; limit?: number }
) {
  const hasCategory = categoryId !== undefined && categoryId !== null && String(categoryId) !== ''
  const query: string[] = []
  if (hasCategory) query.push(`categoryId=${encodeURIComponent(String(categoryId))}`)
  if (options && options.tag) query.push(`tag=${encodeURIComponent(String(options.tag))}`)
  if (options && options.limit) query.push(`limit=${encodeURIComponent(String(options.limit))}`)
  return request(`getAdoptProducts/${query.length ? `?${query.join('&')}` : ''}`)
}

export function getAdoptProductDetail(id: string | number) {
  return request(`getAdoptProductDetail/?id=${id}`)
}

export function getAdoptAvatarOptions(templateId?: string | number) {
  const hasTemplate = templateId !== undefined && templateId !== null && String(templateId) !== ''
  return request(`getAdoptAvatarOptions/${hasTemplate ? `?templateId=${templateId}` : ''}`)
}

export async function getMyAdoptArchive() {
  return requestWithAuthRetry('getMyAdoptArchive/', 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getAdoptOrderMonitorPlayInfo(orderId: string | number) {
  return requestWithAuthRetry(`getAdoptOrderMonitorPlayInfo/?id=${encodeURIComponent(String(orderId))}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function getAdoptGiftShipments(orderId?: string | number, page = 1, pageSize = 10) {
  const query: string[] = [
    `page=${encodeURIComponent(String(page))}`,
    `pageSize=${encodeURIComponent(String(pageSize))}`,
  ]
  if (orderId !== undefined && orderId !== null && String(orderId) !== '') {
    query.push(`orderId=${encodeURIComponent(String(orderId))}`)
  }
  return requestWithAuthRetry(`getAdoptGiftShipments/?${query.join('&')}`, 'GET', undefined, {
    allowReloginWhenRejected: true,
  })
}

export async function createAdoptChatMessage(data: {
  adoptOrderId: string | number
  message: string
  history?: Array<{ role: string; text: string }>
}) {
  return requestWithAuthRetry('createAdoptChatMessage/', 'POST', data as unknown as AnyObject, {
    allowReloginWhenRejected: true,
  })
}

export async function createAdoptOrder(data: {
  productId: string | number
  adoptName: string
  adoptAvatar?: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  buyerRemark?: string
  couponId?: string | number
  invoice?: Record<string, unknown> | null
}) {
  return requestWithAuthRetry('createAdoptOrder/', 'POST', {
    productId: data.productId,
    adoptName: data.adoptName,
    adoptAvatar: data.adoptAvatar || '',
    receiverName: data.receiverName,
    receiverPhone: data.receiverPhone,
    receiverAddress: data.receiverAddress,
    buyerRemark: data.buyerRemark || '',
    couponId: data.couponId || 0,
    invoice: data.invoice || null,
  }, { allowReloginWhenRejected: false })
}

export async function confirmAdoptOrderPaid(orderNo: string) {
  return requestWithAuthRetry('confirmAdoptOrderPaid/', 'POST', { orderNo }, {
    allowReloginWhenRejected: false,
  })
}

export async function cancelAdoptOrder(orderNo: string) {
  return requestWithAuthRetry('cancelAdoptOrder/', 'POST', { orderNo }, {
    allowReloginWhenRejected: false,
  })
}

export async function createBalanceRechargeOrder(packageId: string | number) {
  return requestWithAuthRetry('createBalanceRechargeOrder/', 'POST', { packageId }, {
    allowReloginWhenRejected: false,
  })
}

export async function confirmBalanceRechargePaid(rechargeNo: string) {
  return requestWithAuthRetry('confirmBalanceRechargePaid/', 'POST', { rechargeNo }, {
    allowReloginWhenRejected: false,
  })
}

export async function repayBalanceRechargeOrder(rechargeNo: string) {
  return requestWithAuthRetry('repayBalanceRechargeOrder/', 'POST', { rechargeNo }, {
    allowReloginWhenRejected: false,
  })
}

