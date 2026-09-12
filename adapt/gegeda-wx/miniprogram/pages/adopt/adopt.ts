import {
  createAdoptChatMessage,
  getAdoptGiftShipments,
  getAdoptOrderMonitorPlayInfo,
  getAdoptCategories,
  getAdoptProducts,
  getBaseInfo,
  getMyAdoptArchive,
  hasMiniLogin,
} from '../../utils/api'

interface GiftExpressTrack {
  time: string
  context: string
}

interface AdoptGiftShipment {
  id: string
  shipmentNo: string
  periodIndex: number
  periodTotal: number
  giftTitle: string
  plannedDate: string
  status: string
  statusText: string
  deliveryMethod: string
  deliveryMethodText: string
  isOfflineDelivery: boolean
  deliverySummary: string
  trackEmptyText: string
  giftItemName: string
  giftItemCount: number
  giftItemUnit: string
  expressCompany: string
  expressNo: string
  expressLastContext: string
  expressLastTime: string
  expressTracks: GiftExpressTrack[]
}

interface AdoptChicken {
  id: string
  name: string
  ringNo: string
  avatar: string
  mood: string
  statusText: string
  startLabel: string
  endLabel: string
  daysTotal: number
  daysPassed: number
  daysLeft: number
  progressPercent: number
  isVirtual?: boolean
  monitorCameraId?: string
  monitorCameraName?: string
  monitorCameraNo?: string
  canViewMonitor?: boolean
  giftShipments?: AdoptGiftShipment[]
  giftItemName?: string
  giftItemUnit?: string
  giftItemCount?: number
}

interface AdoptGoodsCategory {
  id: string
  label: string
  name?: string
}

interface AdoptPlanGoods {
  id: string
  categoryId: string | number
  name: string
  cycle: string
  eggText: string
  price: string
  img: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'chicken'
  text: string
}

const DEFAULT_ADOPT_GOODS_CATEGORIES: AdoptGoodsCategory[] = [{ id: 'all', label: '全部' }]
const DEFAULT_AVATAR = '/images/adopt/adapt.svg'
const POSTER_TEMPLATE = '/pages/adopt/images/adopt/poster-template.png'
const POSTER_TEMPLATE_FALLBACKS = [
  POSTER_TEMPLATE,
  'images/adopt/poster-template.png',
]
const POSTER_LOGO = '/images/tabbar/home_activate.png'
const POSTER_LOGO_FALLBACKS = [
  POSTER_LOGO,
]
const POSTER_CANVAS_ID = 'adoptPosterCanvas'
const POSTER_W = 750
const POSTER_H = 1125
const ALLOW_LEGACY_POSTER_FALLBACK = false
const CHAT_STORAGE_PREFIX = 'gegeda_adopt_chat_v1_'
const MAX_LOCAL_CHAT_MESSAGES = 50
const CHAT_TEASER_TEXTS: string[] = [
  '今天状态不错，来聊聊吧',
  '它正在农场等你问候',
  '点开看看它想说什么',
]
const CHAT_WELCOME_TEXTS_MORNING: string[] = [
  '刚在农场里溜达了一圈',
  '今天一早就在等你来看我',
  '早起之后精神特别好',
]
const CHAT_WELCOME_TEXTS_NOON: string[] = [
  '刚吃完饭，这会儿状态很不错',
  '中午的农场特别安静',
  '我正慢悠悠地休息着',
]
const CHAT_WELCOME_TEXTS_AFTERNOON: string[] = [
  '今天下午过得挺惬意',
  '这会儿正在农场里闲逛',
  '下午的风吹着特别舒服',
]
const CHAT_WELCOME_TEXTS_EVENING: string[] = [
  '晚上的农场很安静',
  '我这会儿正准备好好休息',
  '晚上也在等你来找我聊天',
]

function filterAdoptPlansByCategory(list: AdoptPlanGoods[], categoryId: string): AdoptPlanGoods[] {
  if (categoryId === 'all') return list.slice()
  return list.filter((item) => String(item.categoryId) === String(categoryId))
}

function normalizeAdoptGoodsCategories(rows: Record<string, any>[]): AdoptGoodsCategory[] {
  const result: AdoptGoodsCategory[] = [{ id: 'all', label: '全部', name: '全部' }]
  const usedIds: Record<string, boolean> = { all: true }
  const usedLabels: Record<string, boolean> = { 全部: true }

  rows.forEach((item) => {
    const id = String(item.id || '').trim()
    const label = String(item.label || item.name || '').trim()
    const name = String(item.name || item.label || '').trim()
    if (!id || !label) return
    if (id.toLowerCase() === 'all' || label === '全部' || name === '全部') return
    if (usedIds[id] || usedLabels[label]) return
    usedIds[id] = true
    usedLabels[label] = true
    result.push({ id, label, name })
  })

  return result
}

function formatAdoptDate(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}.${m}.${day}`
}

function adoptionStatusText(start: Date, end: Date, now: Date): string {
  if (now.getTime() < start.getTime()) return '未开始'
  if (now.getTime() > end.getTime()) return '已结束'
  return '进行中'
}

function buildChickenState(start: Date, end: Date, now: Date) {
  const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  let passed = 0
  if (now.getTime() >= end.getTime()) {
    passed = total
  } else if (now.getTime() > start.getTime()) {
    passed = Math.floor((now.getTime() - start.getTime()) / 86400000)
  }
  passed = Math.max(0, Math.min(passed, total))
  const left = Math.max(total - passed, 0)
  let pct = Math.round((passed / total) * 100)
  if (pct < 0) pct = 0
  if (pct > 100) pct = 100
  return {
    startLabel: formatAdoptDate(start),
    endLabel: formatAdoptDate(end),
    daysTotal: total,
    daysPassed: passed,
    daysLeft: left,
    progressPercent: pct,
  }
}

function buildAdoption(
  id: string,
  name: string,
  ringNo: string,
  avatar: string,
  start: Date,
  end: Date,
  now: Date,
  moodText?: string,
  fixedStatusText?: string,
): AdoptChicken {
  const span = buildChickenState(start, end, now)
  return {
    id,
    name,
    ringNo,
    avatar,
    mood: moodText || '',
    statusText: fixedStatusText || adoptionStatusText(start, end, now),
    ...span,
  }
}

function buildEmptyAdoption(): AdoptChicken {
  return {
    id: 'empty',
    name: '小白',
    ringNo: '待认养',
    avatar: DEFAULT_AVATAR,
    mood: '',
    statusText: '未认养',
    startLabel: '未开始',
    endLabel: '未开始',
    daysTotal: 0,
    daysPassed: 0,
    daysLeft: 0,
    progressPercent: 0,
    isVirtual: true,
    monitorCameraId: '',
    monitorCameraName: '',
    monitorCameraNo: '',
    canViewMonitor: false,
    giftShipments: [],
  }
}

function pickChatTeaserText(): string {
  const idx = Math.floor(Math.random() * CHAT_TEASER_TEXTS.length)
  return CHAT_TEASER_TEXTS[idx] || CHAT_TEASER_TEXTS[0]
}

function getDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function getChatWelcomePool(): string[] {
  const hour = new Date().getHours()
  if (hour < 11) return CHAT_WELCOME_TEXTS_MORNING
  if (hour < 14) return CHAT_WELCOME_TEXTS_NOON
  if (hour < 18) return CHAT_WELCOME_TEXTS_AFTERNOON
  return CHAT_WELCOME_TEXTS_EVENING
}

function pickChatWelcomeText(name: string): string {
  const pool = getChatWelcomePool()
  const idx = Math.floor(Math.random() * pool.length)
  const welcome = pool[idx] || pool[0] || '一直在等你来看看我'
  return `${getDayGreeting()}，我是${name}，${welcome}。`
}

function getChatStorageKey(orderId: string): string {
  return `${CHAT_STORAGE_PREFIX}${orderId || 'default'}`
}

function normalizeLocalChatRows(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>
      const role = String(row.role || '').trim() === 'user' ? 'user' : 'chicken'
      return {
        id: String(row.id || `msg-${Date.now()}`),
        role,
        text: String(row.text || ''),
      } as ChatMessage
    })
    .filter((item) => !!item.text)
}

function loadLocalChatRows(orderId: string): ChatMessage[] {
  try {
    return normalizeLocalChatRows(wx.getStorageSync(getChatStorageKey(orderId)))
  } catch (_) {
    return []
  }
}

function saveLocalChatRows(orderId: string, rows: ChatMessage[]) {
  try {
    wx.setStorageSync(getChatStorageKey(orderId), rows.slice(-MAX_LOCAL_CHAT_MESSAGES))
  } catch (_) {
    /* ignore */
  }
}

function buildWelcomeMessage(name: string): ChatMessage {
  return {
    id: `c-${Date.now()}`,
    role: 'chicken',
    text: pickChatWelcomeText(name),
  }
}

function buildChatHistoryPayload(rows: ChatMessage[]): Array<{ role: string; text: string }> {
  return rows
    .map((item) => ({
      role: item.role === 'user' ? 'user' : 'assistant',
      text: String(item.text || '').trim(),
    }))
    .filter((item) => !!item.text)
    .slice(-5)
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

function drawRoundRect(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function strokeRoundRect(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth: number) {
  ctx.save()
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(lineWidth)
  drawRoundRect(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.restore()
}

function drawWrappedText(
  ctx: WechatMiniprogram.CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const source = String(text || '')
  let line = ''
  let lineCount = 0
  for (let i = 0; i < source.length; i += 1) {
    const testLine = line + source[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      lineCount += 1
      if (lineCount >= maxLines) {
        ctx.fillText(line.length > 1 ? `${line.slice(0, Math.max(line.length - 1, 1))}…` : line, x, y)
        return
      }
      ctx.fillText(line, x, y)
      line = source[i]
      y += lineHeight
    } else {
      line = testLine
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y)
}

function drawPosterLogo(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, size: number) {
  ctx.save()
  ctx.setStrokeStyle('#2f6b2f')
  ctx.setLineWidth(4)
  ctx.setFillStyle('#f7fff0')
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.setFillStyle('#2f6b2f')
  ctx.beginPath()
  ctx.arc(x + size * 0.48, y + size * 0.45, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.58, y + size * 0.44)
  ctx.lineTo(x + size * 0.78, y + size * 0.5)
  ctx.lineTo(x + size * 0.58, y + size * 0.58)
  ctx.closePath()
  ctx.fill()
  ctx.setFillStyle('#f7fff0')
  ctx.beginPath()
  ctx.arc(x + size * 0.42, y + size * 0.38, size * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.setStrokeStyle('#2f6b2f')
  ctx.setLineWidth(5)
  ctx.beginPath()
  ctx.arc(x + size * 0.5, y + size * 0.82, size * 0.36, Math.PI * 1.05, Math.PI * 1.95)
  ctx.stroke()
  ctx.restore()
}

function drawPosterStatIcon(ctx: WechatMiniprogram.CanvasContext, type: string, cx: number, cy: number) {
  ctx.save()
  ctx.setStrokeStyle('#8fbd47')
  ctx.setFillStyle('#f5fbef')
  ctx.setLineWidth(6)
  if (type === 'calendar') {
    strokeRoundRect(ctx, cx - 28, cy - 24, 56, 52, 8, '#8fbd47', 6)
    ctx.setFillStyle('#8fbd47')
    ctx.fillRect(cx - 16, cy - 6, 8, 8)
    ctx.fillRect(cx + 8, cy - 6, 8, 8)
    ctx.fillRect(cx - 16, cy + 14, 8, 8)
    ctx.fillRect(cx + 8, cy + 14, 8, 8)
  } else if (type === 'heart') {
    ctx.setFillStyle('#8fbd47')
    ctx.beginPath()
    ctx.moveTo(cx, cy + 28)
    ctx.bezierCurveTo(cx - 44, cy, cx - 32, cy - 34, cx, cy - 15)
    ctx.bezierCurveTo(cx + 32, cy - 34, cx + 44, cy, cx, cy + 28)
    ctx.fill()
  } else if (type === 'clock') {
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy - 18)
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + 15, cy)
    ctx.stroke()
  } else {
    ctx.setFillStyle('#f7c66a')
    ctx.beginPath()
    if (typeof (ctx as any).ellipse === 'function') {
      ;(ctx as any).ellipse(cx, cy - 2, 22, 30, 0, 0, Math.PI * 2)
    } else {
      ctx.arc(cx, cy - 2, 24, 0, Math.PI * 2)
    }
    ctx.fill()
    ctx.setStrokeStyle('#d6a640')
    ctx.setLineWidth(5)
    ctx.beginPath()
    ctx.arc(cx, cy + 24, 34, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  }
  ctx.restore()
}

function canvasToImage(page: any): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvasId: POSTER_CANVAS_ID,
      width: POSTER_W,
      height: POSTER_H,
      destWidth: POSTER_W,
      destHeight: POSTER_H,
      fileType: 'jpg',
      quality: 0.92,
      success(res: any) {
        resolve(res.tempFilePath)
      },
      fail(err: unknown) {
        reject(err)
      },
    }, page)
  })
}

function loadOffscreenImage(canvas: any, src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.createImage !== 'function') {
      reject(new Error('offscreen canvas image is not supported'))
      return
    }
    const img = canvas.createImage()
    const timer = setTimeout(() => {
      reject(new Error(`poster template load timeout: ${src}`))
    }, 5000)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = (err: unknown) => {
      clearTimeout(timer)
      reject(err)
    }
    img.src = src
  })
}

function drawRoundRect2d(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawPosterLogo2d(ctx: any, x: number, y: number, size: number) {
  ctx.save()
  ctx.strokeStyle = '#2f6b2f'
  ctx.lineWidth = 4
  ctx.fillStyle = '#f7fff0'
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#2f6b2f'
  ctx.beginPath()
  ctx.arc(x + size * 0.48, y + size * 0.45, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.58, y + size * 0.44)
  ctx.lineTo(x + size * 0.78, y + size * 0.5)
  ctx.lineTo(x + size * 0.58, y + size * 0.58)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f7fff0'
  ctx.beginPath()
  ctx.arc(x + size * 0.42, y + size * 0.38, size * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2f6b2f'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(x + size * 0.5, y + size * 0.82, size * 0.36, Math.PI * 1.05, Math.PI * 1.95)
  ctx.stroke()
  ctx.restore()
}

function drawPosterLogoImage2d(ctx: any, img: any, x: number, y: number, size: number) {
  ctx.save()
  ctx.fillStyle = '#fffdf0'
  ctx.strokeStyle = '#2f6b2f'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 4, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(img, x + 4, y + 4, size - 8, size - 8)
  ctx.restore()
}

function drawWrappedText2d(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const source = String(text || '')
  let line = ''
  let lineCount = 0
  for (let i = 0; i < source.length; i += 1) {
    const testLine = line + source[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      lineCount += 1
      if (lineCount >= maxLines) {
        ctx.fillText(line.length > 1 ? `${line.slice(0, Math.max(line.length - 1, 1))}…` : line, x, y)
        return
      }
      ctx.fillText(line, x, y)
      line = source[i]
      y += lineHeight
    } else {
      line = testLine
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y)
}

function drawPosterStatIcon2d(ctx: any, type: string, cx: number, cy: number) {
  ctx.save()
  ctx.strokeStyle = '#8fbd47'
  ctx.fillStyle = '#f5fbef'
  ctx.lineWidth = 6
  if (type === 'calendar') {
    drawRoundRect2d(ctx, cx - 28, cy - 24, 56, 52, 8)
    ctx.stroke()
    ctx.fillStyle = '#8fbd47'
    ctx.fillRect(cx - 16, cy - 6, 8, 8)
    ctx.fillRect(cx + 8, cy - 6, 8, 8)
    ctx.fillRect(cx - 16, cy + 14, 8, 8)
    ctx.fillRect(cx + 8, cy + 14, 8, 8)
  } else if (type === 'heart') {
    ctx.fillStyle = '#8fbd47'
    ctx.beginPath()
    ctx.moveTo(cx, cy + 28)
    ctx.bezierCurveTo(cx - 44, cy, cx - 32, cy - 34, cx, cy - 15)
    ctx.bezierCurveTo(cx + 32, cy - 34, cx + 44, cy, cx, cy + 28)
    ctx.fill()
  } else if (type === 'clock') {
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy - 18)
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + 15, cy)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#f7c66a'
    ctx.beginPath()
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy - 2, 22, 30, 0, 0, Math.PI * 2)
    } else {
      ctx.arc(cx, cy - 2, 24, 0, Math.PI * 2)
    }
    ctx.fill()
    ctx.strokeStyle = '#d6a640'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx, cy + 24, 34, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  }
  ctx.restore()
}

function offscreenCanvasToImage(canvas: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      width: POSTER_W,
      height: POSTER_H,
      destWidth: POSTER_W,
      destHeight: POSTER_H,
      fileType: 'jpg',
      quality: 0.92,
      success(res: any) {
        resolve(res.tempFilePath)
      },
      fail(err: unknown) {
        reject(err)
      },
    }
    if (canvas && typeof canvas.toTempFilePath === 'function') {
      canvas.toTempFilePath(options)
      return
    }
    wx.canvasToTempFilePath({
      canvas,
      width: POSTER_W,
      height: POSTER_H,
      destWidth: POSTER_W,
      destHeight: POSTER_H,
      fileType: 'jpg',
      quality: 0.92,
      success: options.success,
      fail: options.fail,
    } as any)
  })
}

async function drawAdoptPosterOffscreen(
  chicken: AdoptChicken,
  siteName: string,
  slogan: string,
  qrUrl: string,
): Promise<string> {
  const canvas = (wx as any).createOffscreenCanvas({ type: '2d', width: POSTER_W, height: POSTER_H })
  const ctx = canvas.getContext('2d')
  const bgPath = await getPosterTemplatePath()
  const bg = await loadOffscreenImage(canvas, bgPath)
  const logoImg = await loadPosterLogoCanvasNodeImage(canvas)
  const farmName = String(siteName || '认养一只鸡')
  const farmSlogan = String(slogan || '认养一只鸡 好吃又健康')
  const chickenName = String(chicken.name || '小白')
  const giftName = String(chicken.giftItemName || '鸡蛋')
  const giftUnit = String(chicken.giftItemUnit || '枚')
  const giftCount = Number(chicken.giftItemCount || 0) || 0

  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  ctx.drawImage(bg, 0, 0, POSTER_W, POSTER_H)
  assertPosterBackgroundDrawn(ctx, 'offscreen')

  if (logoImg) {
    drawPosterLogoImage2d(ctx, logoImg, 260, 16, 54)
  } else {
    drawPosterLogo2d(ctx, 260, 16, 54)
  }
  ctx.fillStyle = '#2d6a2d'
  ctx.font = '34px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(farmName, 326, 54)

  ctx.save()
  ctx.shadowColor = 'rgba(255, 255, 255, 0.82)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#2f681f'
  ctx.font = '58px sans-serif'
  ctx.fillText('我认养的小鸡', 58, 156)
  ctx.font = '78px sans-serif'
  drawWrappedText2d(ctx, `「${chickenName}」`, 58, 248, 395, 88, 2)
  ctx.restore()

  ctx.fillStyle = '#2e6424'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('已经陪伴我', 68, 375)
  ctx.fillStyle = '#f28717'
  ctx.font = '40px sans-serif'
  ctx.fillText(String(chicken.daysPassed || 0), 232, 377)
  ctx.fillStyle = '#2e6424'
  ctx.font = '28px sans-serif'
  ctx.fillText('天啦', 296, 375)

  const cards = [
    ['calendar', '认养周期', `${chicken.daysTotal || 0}`, '天'],
    ['heart', '已陪伴', `${chicken.daysPassed || 0}`, '天'],
    ['clock', '剩余', `${chicken.daysLeft || 0}`, '天'],
    ['egg', `赠送${giftName}`, `${giftCount}`, giftUnit],
  ]
  cards.forEach((item, index) => {
    const x = 80 + index * 160
    drawPosterStatIcon2d(ctx, item[0], x + 50, 694)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#255122'
    ctx.font = '25px sans-serif'
    ctx.fillText(item[1], x + 50, 780)
    ctx.fillStyle = '#f28717'
    ctx.font = '42px sans-serif'
    ctx.fillText(item[2], x + 38, 832)
    ctx.fillStyle = '#255122'
    ctx.font = '25px sans-serif'
    ctx.fillText(item[3], x + 88, 832)
  })

  ctx.textAlign = 'left'
  ctx.fillStyle = '#356b2b'
  ctx.font = '34px sans-serif'
  ctx.fillText('每天都在农场认真长大', 192, 884)
  ctx.fillStyle = '#f28717'
  ctx.font = '32px sans-serif'
  ctx.fillText('♡', 615, 884)

  if (logoImg) {
    drawPosterLogoImage2d(ctx, logoImg, 62, 1018, 76)
  } else {
    drawPosterLogo2d(ctx, 62, 1018, 76)
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = '32px sans-serif'
  drawWrappedText2d(ctx, farmSlogan, 162, 1058, 360, 40, 2)

  const hasQrCode = await drawPosterQrImage2d(ctx, canvas, qrUrl, 552, 958, 106)
  if (hasQrCode) {
    ctx.fillStyle = '#32652d'
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('\u957f\u6309\u8bc6\u522b\u67e5\u770b\u5b83', 605, 1085)
  }

  return offscreenCanvasToImage(canvas)
}


function getPosterQrUrl(data: Record<string, any>): string {
  if (!data || typeof data !== 'object') return ''
  return String(
    data.miniQrcode ||
    data.mini_qrcode ||
    data.miniprogramQrcode ||
    data.miniProgramQrcode ||
    data.qrcode ||
    ''
  )
}

async function drawPosterQrImage2d(ctx: any, canvas: any, qrUrl: string, x: number, y: number, size: number): Promise<boolean> {
  const safeUrl = String(qrUrl || '')
  if (!safeUrl) return false
  try {
    const localPath = await getImageLocalPath(safeUrl)
    const qrImg = await loadOffscreenImage(canvas, localPath)
    ctx.save()
    drawRoundRect2d(ctx, x, y, size, size, 8)
    ctx.clip()
    ctx.drawImage(qrImg, x, y, size, size)
    ctx.restore()
    return true
  } catch (error) {
    console.warn('adopt poster qrcode load failed', error)
    return false
  }
}

async function getPosterQrLocalPath(qrUrl: string): Promise<string> {
  const safeUrl = String(qrUrl || '')
  if (!safeUrl) return ''
  try {
    return await getImageLocalPath(safeUrl)
  } catch (error) {
    console.warn('adopt poster qrcode local path failed', error)
    return ''
  }
}

function getImageLocalPath(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`poster template load timeout: ${src}`))
    }, 5000)
    wx.getImageInfo({
      src,
      success(res) {
        clearTimeout(timer)
        resolve(res.path || src)
      },
      fail(err) {
        clearTimeout(timer)
        reject(err)
      },
    })
  })
}

async function getPosterTemplatePath(): Promise<string> {
  let lastError: unknown = null
  for (let i = 0; i < POSTER_TEMPLATE_FALLBACKS.length; i += 1) {
    const src = POSTER_TEMPLATE_FALLBACKS[i]
    try {
      const path = await getImageLocalPath(src)
      console.log('adopt poster template loaded', src, path)
      return path
    } catch (error) {
      lastError = error
      console.warn('adopt poster template load failed', src, error)
    }
  }
  throw lastError || new Error('poster template load failed')
}

function getPosterCanvasNode(page: any): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(page)
      .select(`#${POSTER_CANVAS_ID}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node
        if (!node || typeof node.getContext !== 'function') {
          reject(new Error('poster canvas node not found'))
          return
        }
        node.width = POSTER_W
        node.height = POSTER_H
        resolve(node)
      })
  })
}

function loadCanvasNodeImage(canvas: any, src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.createImage !== 'function') {
      reject(new Error('canvas image is not supported'))
      return
    }
    const img = canvas.createImage()
    const timer = setTimeout(() => {
      reject(new Error(`poster image load timeout: ${src}`))
    }, 8000)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = (err: unknown) => {
      clearTimeout(timer)
      reject(err || new Error(`poster image load failed: ${src}`))
    }
    img.src = src
  })
}

async function loadPosterCanvasNodeImage(canvas: any): Promise<any> {
  let lastError: unknown = null
  for (let i = 0; i < POSTER_TEMPLATE_FALLBACKS.length; i += 1) {
    const src = POSTER_TEMPLATE_FALLBACKS[i]
    try {
      console.log('adopt poster type2d image try', src)
      return await loadCanvasNodeImage(canvas, src)
    } catch (error) {
      lastError = error
      console.warn('adopt poster type2d direct image failed', src, error)
    }
    try {
      const localPath = await getImageLocalPath(src)
      console.log('adopt poster type2d local image try', src, localPath)
      return await loadCanvasNodeImage(canvas, localPath)
    } catch (error) {
      lastError = error
      console.warn('adopt poster type2d local image failed', src, error)
    }
  }
  throw lastError || new Error('poster image load failed')
}

async function loadPosterLogoCanvasNodeImage(canvas: any): Promise<any | null> {
  let lastError: unknown = null
  for (let i = 0; i < POSTER_LOGO_FALLBACKS.length; i += 1) {
    const src = POSTER_LOGO_FALLBACKS[i]
    try {
      return await loadCanvasNodeImage(canvas, src)
    } catch (error) {
      lastError = error
      console.warn('adopt poster logo direct image failed', src, error)
    }
    try {
      const localPath = await getImageLocalPath(src)
      return await loadCanvasNodeImage(canvas, localPath)
    } catch (error) {
      lastError = error
      console.warn('adopt poster logo local image failed', src, error)
    }
  }
  console.warn('adopt poster logo load failed, use vector fallback', lastError)
  return null
}

function canvasNodeToImage(canvas: any): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: POSTER_W,
      height: POSTER_H,
      destWidth: POSTER_W,
      destHeight: POSTER_H,
      fileType: 'jpg',
      quality: 0.92,
      success(res: any) {
        resolve(res.tempFilePath)
      },
      fail(err: unknown) {
        reject(err)
      },
    } as any)
  })
}

function assertPosterBackgroundDrawn(ctx: any, label: string) {
  if (!ctx || typeof ctx.getImageData !== 'function') return
  const data = ctx.getImageData(540, 360, 1, 1).data
  const isTransparent = Number(data[3] || 0) === 0
  const isNearlyBlank = Number(data[0] || 0) > 245 && Number(data[1] || 0) > 245 && Number(data[2] || 0) > 245
  if (isTransparent || isNearlyBlank) {
    throw new Error(`${label} poster background was not drawn`)
  }
}

async function drawAdoptPosterType2d(
  page: any,
  chicken: AdoptChicken,
  siteName: string,
  slogan: string,
  qrUrl: string,
): Promise<string> {
  const canvas = await getPosterCanvasNode(page)
  const ctx = canvas.getContext('2d')
  const bg = await loadPosterCanvasNodeImage(canvas)
  const logoImg = await loadPosterLogoCanvasNodeImage(canvas)
  const farmName = String(siteName || '认养一只鸡')
  const farmSlogan = String(slogan || '认养一只鸡 好吃又健康')
  const chickenName = String(chicken.name || '小白')
  const giftName = String(chicken.giftItemName || '鸡蛋')
  const giftUnit = String(chicken.giftItemUnit || '枚')
  const giftCount = Number(chicken.giftItemCount || 0) || 0

  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  ctx.drawImage(bg, 0, 0, POSTER_W, POSTER_H)
  assertPosterBackgroundDrawn(ctx, 'type2d')
  console.log('adopt poster type2d background drawn')

  if (logoImg) {
    drawPosterLogoImage2d(ctx, logoImg, 260, 16, 54)
  } else {
    drawPosterLogo2d(ctx, 260, 16, 54)
  }
  ctx.fillStyle = '#2d6a2d'
  ctx.font = '34px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(farmName, 326, 54)

  ctx.save()
  ctx.shadowColor = 'rgba(255, 255, 255, 0.82)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#2f681f'
  ctx.font = '58px sans-serif'
  ctx.fillText('我认养的小鸡', 58, 156)
  ctx.font = '78px sans-serif'
  drawWrappedText2d(ctx, `「${chickenName}」`, 58, 248, 395, 88, 2)
  ctx.restore()

  ctx.fillStyle = '#2e6424'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('已经陪伴我', 68, 375)
  ctx.fillStyle = '#f28717'
  ctx.font = '40px sans-serif'
  ctx.fillText(String(chicken.daysPassed || 0), 232, 377)
  ctx.fillStyle = '#2e6424'
  ctx.font = '28px sans-serif'
  ctx.fillText('天啦', 296, 375)

  const cards = [
    ['calendar', '认养周期', `${chicken.daysTotal || 0}`, '天'],
    ['heart', '已陪伴', `${chicken.daysPassed || 0}`, '天'],
    ['clock', '剩余', `${chicken.daysLeft || 0}`, '天'],
    ['egg', `赠送${giftName}`, `${giftCount}`, giftUnit],
  ]
  cards.forEach((item, index) => {
    const x = 80 + index * 160
    drawPosterStatIcon2d(ctx, item[0], x + 50, 694)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#255122'
    ctx.font = '25px sans-serif'
    ctx.fillText(item[1], x + 50, 780)
    ctx.fillStyle = '#f28717'
    ctx.font = '42px sans-serif'
    ctx.fillText(item[2], x + 38, 832)
    ctx.fillStyle = '#255122'
    ctx.font = '25px sans-serif'
    ctx.fillText(item[3], x + 88, 832)
  })

  ctx.textAlign = 'left'
  ctx.fillStyle = '#356b2b'
  ctx.font = '34px sans-serif'
  ctx.fillText('每天都在农场认真长大', 192, 884)
  ctx.fillStyle = '#f28717'
  ctx.font = '32px sans-serif'
  ctx.fillText('♡', 615, 884)

  if (logoImg) {
    drawPosterLogoImage2d(ctx, logoImg, 62, 1018, 76)
  } else {
    drawPosterLogo2d(ctx, 62, 1018, 76)
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = '32px sans-serif'
  drawWrappedText2d(ctx, farmSlogan, 162, 1058, 360, 40, 2)

  const hasQrCode = await drawPosterQrImage2d(ctx, canvas, qrUrl, 552, 958, 106)
  if (hasQrCode) {
    ctx.fillStyle = '#32652d'
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('\u957f\u6309\u8bc6\u522b\u67e5\u770b\u5b83', 605, 1085)
  }

  const imagePath = await canvasNodeToImage(canvas)
  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  return imagePath
}

async function drawAdoptPosterLegacy(
  page: any,
  chicken: AdoptChicken,
  siteName: string,
  slogan: string,
  qrUrl: string,
): Promise<string> {
  const ctx = wx.createCanvasContext(POSTER_CANVAS_ID, page)
  const farmName = String(siteName || '认养一只鸡')
  const farmSlogan = String(slogan || '认养一只鸡 好吃又健康')
  const chickenName = String(chicken.name || '小白')
  const giftName = String(chicken.giftItemName || '鸡蛋')
  const giftUnit = String(chicken.giftItemUnit || '枚')
  const giftCount = Number(chicken.giftItemCount || 0) || 0

  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  const templatePath = await getPosterTemplatePath()
  ctx.drawImage(templatePath, 0, 0, POSTER_W, POSTER_H)

  drawPosterLogo(ctx, 262, 24, 48)
  ctx.setFillStyle('#2d6a2d')
  ctx.setFontSize(34)
  ctx.setTextAlign('left')
  ctx.fillText(farmName, 326, 60)

  ctx.save()
  ctx.setShadow(0, 2, 2, 'rgba(255, 255, 255, 0.82)')
  ctx.setTextAlign('left')
  ctx.setFillStyle('#2f681f')
  ctx.setFontSize(58)
  ctx.fillText('我认养的小鸡', 58, 216)
  ctx.setFontSize(78)
  drawWrappedText(ctx, `「${chickenName}」`, 58, 318, 395, 88, 2)
  ctx.restore()

  ctx.setFillStyle('#2e6424')
  ctx.setFontSize(28)
  ctx.setTextAlign('left')
  ctx.fillText('已经陪伴我', 142, 458)
  ctx.setFillStyle('#f28717')
  ctx.setFontSize(40)
  ctx.fillText(String(chicken.daysPassed || 0), 306, 460)
  ctx.setFillStyle('#2e6424')
  ctx.setFontSize(28)
  ctx.fillText('天啦', 370, 458)

  const cards = [
    ['calendar', '认养周期', `${chicken.daysTotal || 0}`, '天'],
    ['heart', '已陪伴', `${chicken.daysPassed || 0}`, '天'],
    ['clock', '剩余', `${chicken.daysLeft || 0}`, '天'],
    ['egg', `赠送${giftName}`, `${giftCount}`, giftUnit],
  ]
  cards.forEach((item, index) => {
    const x = 80 + index * 160
    drawPosterStatIcon(ctx, item[0], x + 50, 736)
    ctx.setTextAlign('center')
    ctx.setFillStyle('#255122')
    ctx.setFontSize(25)
    ctx.fillText(item[1], x + 50, 802)
    ctx.setFillStyle('#f28717')
    ctx.setFontSize(42)
    ctx.fillText(item[2], x + 38, 850)
    ctx.setFillStyle('#255122')
    ctx.setFontSize(25)
    ctx.fillText(item[3], x + 88, 850)
  })

  ctx.setTextAlign('left')
  ctx.setFillStyle('#356b2b')
  ctx.setFontSize(34)
  ctx.fillText('每天都在农场认真长大', 192, 932)
  ctx.setFillStyle('#f28717')
  ctx.setFontSize(32)
  ctx.fillText('♡', 615, 932)

  drawPosterLogo(ctx, 62, 1018, 76)
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(32)
  ctx.setTextAlign('left')
  drawWrappedText(ctx, farmSlogan, 162, 1058, 360, 40, 2)

  const qrPath = await getPosterQrLocalPath(qrUrl)
  if (qrPath) {
    ctx.drawImage(qrPath, 552, 958, 106, 106)
    ctx.setFillStyle('#32652d')
    ctx.setFontSize(20)
    ctx.setTextAlign('center')
    ctx.fillText('\u957f\u6309\u8bc6\u522b\u67e5\u770b\u5b83', 605, 1085)
  }
  ctx.setTextAlign('left')

  await new Promise<void>((resolve) => {
    ctx.draw(false, () => {
      setTimeout(() => resolve(), 120)
    })
  })
  const imagePath = await canvasToImage(page)
  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  ctx.draw(false)
  return imagePath
}

async function drawAdoptPoster(
  page: any,
  chicken: AdoptChicken,
  siteName: string,
  slogan: string,
  qrUrl: string,
): Promise<string> {
  try {
    return await drawAdoptPosterType2d(page, chicken, siteName, slogan, qrUrl)
  } catch (error) {
    console.warn('adopt poster type2d failed, fallback to other canvas', error)
  }
  if (typeof (wx as any).createOffscreenCanvas === 'function') {
    try {
      return await drawAdoptPosterOffscreen(chicken, siteName, slogan, qrUrl)
    } catch (error) {
      console.warn('adopt poster offscreen failed, fallback to legacy canvas', error)
    }
  }
  if (ALLOW_LEGACY_POSTER_FALLBACK) {
    return drawAdoptPosterLegacy(page, chicken, siteName, slogan, qrUrl)
  }
  throw new Error('adopt poster background render failed')
}


function normalizeGiftShipments(value: unknown): AdoptGiftShipment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const item = (raw || {}) as Record<string, any>
      const giftName = String(item.giftItemName || item.gift_item_name || '\u8d60\u9001\u7269')
      const giftCount = Number(item.giftItemCount || item.gift_item_count || 0) || 0
      const giftUnit = String(item.giftItemUnit || item.gift_item_unit || '')
      const giftTitle = String(item.giftTitle || item.gift_title || `${giftName}${giftCount}${giftUnit}`)
      const deliveryMethod = String(item.deliveryMethod || item.delivery_method || 'express_free')
      const deliveryMethodText = String(item.deliveryMethodText || item.delivery_method_text || (deliveryMethod === 'offline' ? '线下配送' : '快递包邮'))
      const expressCompany = String(item.expressCompany || item.express_company || '')
      const expressNo = String(item.expressNo || item.express_no || '')
      const expressLastContext = String(item.expressLastContext || item.express_last_context || '')
      const isOfflineDelivery = deliveryMethod === 'offline'
      return {
        id: String(item.id || item.shipmentNo || item.shipment_no || Date.now()),
        shipmentNo: String(item.shipmentNo || item.shipment_no || ''),
        periodIndex: Number(item.periodIndex || item.period_index || 0) || 0,
        periodTotal: Number(item.periodTotal || item.period_total || 0) || 0,
        giftTitle,
        plannedDate: String(item.plannedDate || item.planned_date || ''),
        status: String(item.status || ''),
        statusText: String(item.statusText || item.status_text || ''),
        deliveryMethod,
        deliveryMethodText,
        isOfflineDelivery,
        deliverySummary: isOfflineDelivery ? '线下配送，已完成签收' : (expressNo ? `${deliveryMethodText} · ${expressCompany} ${expressNo}` : `${deliveryMethodText} · 物流信息待更新`),
        trackEmptyText: isOfflineDelivery ? '线下配送，已完成签收。' : (expressLastContext || '暂无物流轨迹，发货后会自动同步更新。'),
        giftItemName: giftName,
        giftItemCount: giftCount,
        giftItemUnit: giftUnit,
        expressCompany,
        expressNo,
        expressLastContext,
        expressLastTime: String(item.expressLastTime || item.express_last_time || ''),
        expressTracks: normalizeGiftExpressTracks(item.expressTracks || item.express_tracks || []),
      }
    })
    .filter((item) => !!item.id)
}

function normalizeGiftExpressTracks(value: unknown): GiftExpressTrack[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const item = (raw || {}) as Record<string, any>
      return {
        time: String(item.time || item.ftime || item.acceptTime || item.accept_time || ''),
        context: String(item.context || item.desc || item.status || item.acceptStation || item.accept_station || ''),
      }
    })
    .filter((item) => !!item.context || !!item.time)
}

function inferGiftTotalCount(rows?: AdoptGiftShipment[]): number {
  if (!rows || !rows.length) return 0
  const first = rows[0]
  const periodTotal = Number(first.periodTotal || 0) || rows.length
  const perCount = Number(first.giftItemCount || 0) || 0
  if (periodTotal > 0 && perCount > 0) return periodTotal * perCount
  let total = 0
  rows.forEach((item) => {
    total += Number(item.giftItemCount || 0) || 0
  })
  return total
}

function parseDateTime(value: unknown): Date | null {
  const text = String(value || '').trim()
  if (!text) return null
  const normalized = text.replace(/-/g, '/').replace('T', ' ').replace('Z', '')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.max(days, 1) * 86400000)
}

function readNumber(value: any, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapArchiveToAdoption(item: Record<string, any>): AdoptChicken {
  const now = new Date()
  const startText = String(item.archiveStartTime || item.archive_start_time || item.confirmTime || item.confirm_time || '')
  const endText = String(item.archiveEndTime || item.archive_end_time || '')
  const totalFromApi = Math.max(readNumber(item.daysTotal || item.days_total || item.adoptDays || item.adopt_days, 0), 0)
  const start =
    parseDateTime(
      startText,
    ) || now
  const end =
    parseDateTime(endText) ||
    addDays(start, Math.max(totalFromApi, 1))
  const row = buildAdoption(
    String(item.id || item.orderNo || Date.now()),
    String(item.adoptName || item.adopt_name || item.title || '我的认养宝贝'),
    String(item.orderNo || item.order_no || '--').slice(-8) || '--',
    String(item.adoptAvatar || item.adopt_avatar || DEFAULT_AVATAR),
    start,
    end,
    now,
    '',
    String(item.statusText || item.status_text || '进行中'),
  )
  const hasBackendSpan =
    item.daysPassed !== undefined ||
    item.days_passed !== undefined ||
    item.daysLeft !== undefined ||
    item.days_left !== undefined ||
    item.daysTotal !== undefined ||
    item.days_total !== undefined
  if (hasBackendSpan) {
    const rawPassed = readNumber(item.daysPassed !== undefined ? item.daysPassed : item.days_passed, 0)
    const rawLeft = readNumber(item.daysLeft !== undefined ? item.daysLeft : item.days_left, 0)
    const total = Math.max(totalFromApi || rawPassed + rawLeft, 0)
    const passed = total > 0 ? Math.max(0, Math.min(Math.floor(rawPassed), total)) : 0
    const left = total > 0 ? Math.max(0, Math.min(Math.floor(rawLeft || total - passed), total)) : 0
    row.daysTotal = total
    row.daysPassed = passed
    row.daysLeft = left
    row.progressPercent = total > 0 ? Math.max(0, Math.min(Math.round((passed / total) * 100), 100)) : 0
  }
  if (!startText) {
    row.startLabel = '--'
    row.endLabel = '--'
  }
  const giftItemName = String(item.giftItemName || item.gift_item_name || '鸡蛋')
  const giftItemUnit = String(item.giftItemUnit || item.gift_item_unit || '枚')
  const giftItemCount = Number(item.giftItemCount || item.gift_item_count || 0) || 0
  row.monitorCameraId = String(item.monitorCameraId || item.monitor_camera_id || '')
  row.monitorCameraName = String(item.monitorCameraName || item.monitor_camera_name || '')
  row.monitorCameraNo = String(item.monitorCameraNo || item.monitor_camera_no || '')
  row.canViewMonitor = Boolean(
    row.monitorCameraId &&
      (item.canViewMonitor === true ||
        item.can_view_monitor === true ||
        String(item.status || item.orderStatus || item.order_status || '') === 'confirmed'),
  )
  row.giftShipments = normalizeGiftShipments(item.giftShipments || item.gift_shipments || [])
  row.giftItemName = giftItemName
  row.giftItemUnit = giftItemUnit
  row.giftItemCount = giftItemCount || inferGiftTotalCount(row.giftShipments)
  return row
}

Page({
  data: {
    adoptions: [buildEmptyAdoption()] as AdoptChicken[],
    adoptionIndex: 0,
    adoptionIndexDisplay: 1,
    adoptionTotal: 1,
    currentChicken: buildEmptyAdoption() as AdoptChicken,
    adoptGoodsCategories: DEFAULT_ADOPT_GOODS_CATEGORIES,
    activeAdoptGoodsCategoryId: 'all',
    adoptGoodsDisplayList: [] as AdoptPlanGoods[],
    allAdoptGoods: [] as AdoptPlanGoods[],
    chatVisible: false,
    chatOrderId: '',
    chatMessages: [] as ChatMessage[],
    chatInput: '',
    chatSending: false,
    chatScrollIntoView: '',
    chatTeaserText: pickChatTeaserText(),
    monitorVisible: false,
    monitorTitle: '监控预览',
    monitorLoading: false,
    monitorReady: false,
    monitorStarted: false,
    monitorAccessToken: '',
    monitorPlayUrl: '',
    monitorErrorText: '',
    monitorPlayerPlugins: '',
    monitorPlayerTheme: {
      showCapture: false,
      showBottomBar: false,
      showDatePicker: false,
      showTypeSwitch: false,
      showPlayBtn: false,
      showFullScreenBtn: false,
      showHdBtn: false,
      showVoiceBtn: false,
    },
    giftVisible: false,
    giftLoading: false,
    giftDetailMode: false,
    giftList: [] as AdoptGiftShipment[],
    giftSelected: null as AdoptGiftShipment | null,
    giftPanelTitle: '赠送记录',
    posterVisible: false,
    posterGenerating: false,
    posterImagePath: '',
  },

  onLoad() {
    enableShareMenu()
    this.setData({ chatTeaserText: pickChatTeaserText() })
    this.loadAdoptGoods()
  },

  onShareAppMessage() {
    const current = this.data.currentChicken || buildEmptyAdoption()
    const goods = this.data.adoptGoodsDisplayList || []
    const firstGoods = goods.length ? goods[0] : null
    return {
      title: current && !current.isVirtual ? `我在农场认养了${current.name}，来看看它今天怎么样` : '来农场认养一只小伙伴，把日子过得更有盼头',
      path: '/pages/adopt/adopt',
      imageUrl: (current && current.avatar) || (firstGoods && firstGoods.img) || DEFAULT_AVATAR,
    }
  },

  onShareTimeline() {
    const current = this.data.currentChicken || buildEmptyAdoption()
    const goods = this.data.adoptGoodsDisplayList || []
    const firstGoods = goods.length ? goods[0] : null
    return {
      title: current && !current.isVirtual ? `我在农场认养了${current.name}，来看看它今天怎么样` : '来农场认养一只小伙伴，把日子过得更有盼头',
      query: '',
      imageUrl: (current && current.avatar) || (firstGoods && firstGoods.img) || DEFAULT_AVATAR,
    }
  },

  onShow() {
    this.setData({ chatTeaserText: pickChatTeaserText() })
    this.loadAdoptGoods()
    this.loadAdoptArchive()
  },

  noop() {},

  async onPosterTap(e: WechatMiniprogram.TouchEvent) {
    if (this.data.posterGenerating) return
    const id = String(e.currentTarget.dataset.id || '')
    let current = this.data.currentChicken as AdoptChicken
    if (id) {
      const idx = this.data.adoptions.findIndex((item) => String(item.id) === id)
      if (idx >= 0) current = this.data.adoptions[idx]
    }
    if (!current || current.isVirtual) {
      wx.showToast({ title: '暂无可分享的认养档案', icon: 'none' })
      return
    }
    this.setData({
      posterGenerating: true,
      posterVisible: false,
      posterImagePath: '',
    })
    wx.showLoading({ title: '生成海报中', mask: true })
    try {
      const baseResp = (await getBaseInfo()) as Record<string, any>
      const baseData = (baseResp && baseResp.data ? baseResp.data : {}) as Record<string, any>
      const siteName = String(baseData.siteName || baseData.name || '认养一只鸡')
      const slogan = String(baseData.slogan || baseData.siteSlogan || '认养一只鸡 好吃又健康')
      const qrUrl = getPosterQrUrl(baseData)
      const imagePath = await drawAdoptPoster(this, current, siteName, slogan, qrUrl)
      wx.hideLoading()
      this.setData({
        posterImagePath: imagePath,
        posterVisible: true,
        currentChicken: current,
      })
    } catch (error) {
      wx.hideLoading()
      console.error('generate adopt poster error', error)
      wx.showToast({ title: '海报生成失败，请重试', icon: 'none' })
    } finally {
      this.setData({ posterGenerating: false })
    }
  },

  closePoster() {
    this.setData({ posterVisible: false })
  },

  previewPosterImage() {
    const path = String(this.data.posterImagePath || '')
    if (!path) {
      wx.showToast({ title: '请先生成海报', icon: 'none' })
      return
    }
    wx.previewImage({
      current: path,
      urls: [path],
      showmenu: true,
    } as any)
  },

  savePosterToAlbum() {
    const path = String(this.data.posterImagePath || '')
    if (!path) {
      wx.showToast({ title: '请先生成海报', icon: 'none' })
      return
    }
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail() {
        wx.showModal({
          title: '保存失败',
          content: '请确认已授权保存到相册，保存后可以发布朋友圈。',
          confirmText: '去设置',
          success(res) {
            if (res.confirm) wx.openSetting({})
          },
        })
      },
    })
  },

  async loadAdoptArchive() {
    if (!hasMiniLogin()) {
      const empty = buildEmptyAdoption()
      this.setData({
        adoptions: [empty],
        adoptionTotal: 1,
        adoptionIndex: 0,
        adoptionIndexDisplay: 1,
        currentChicken: empty,
      })
      return
    }

    try {
      const resp = (await getMyAdoptArchive()) as Record<string, any>
      const rows = Array.isArray(resp.data) ? resp.data : []
      const list = rows.map((item) => mapArchiveToAdoption(item))
      const nextList = list.length ? list : [buildEmptyAdoption()]
      this.setData({
        adoptions: nextList,
        adoptionTotal: nextList.length,
        adoptionIndex: 0,
        adoptionIndexDisplay: 1,
        currentChicken: nextList[0],
      })
    } catch (error) {
      console.error('loadAdoptArchive error', error)
      const empty = buildEmptyAdoption()
      this.setData({
        adoptions: [empty],
        adoptionTotal: 1,
        adoptionIndex: 0,
        adoptionIndexDisplay: 1,
        currentChicken: empty,
      })
    }
  },

  async loadAdoptGoods() {
    try {
      const categoryResp = (await getAdoptCategories()) as Record<string, any>
      const productResp = (await getAdoptProducts('all')) as Record<string, any>
      const categoryRows = Array.isArray(categoryResp.data) ? categoryResp.data : []
      const productRows = Array.isArray(productResp.data) ? productResp.data : []

      const categories = normalizeAdoptGoodsCategories(categoryRows)
      const goods = productRows.map((item) => ({
        id: String(item.id || ''),
        categoryId: item.categoryId || item.category_id || '',
        name: String(item.name || item.title || ''),
        cycle: `认养周期 · ${item.adoptDays || item.adopt_days || 0}天`,
        eggText: `${item.giftItemName || item.gift_item_name || '鸡蛋'} · ${item.giftEggCount || item.gift_egg_count || 0}${item.giftItemUnit || item.gift_item_unit || '枚'}`,
        price: String(item.price || '0.00'),
        img: String(item.img || item.cover || DEFAULT_AVATAR),
      }))

      this.setData({
        adoptGoodsCategories: categories,
        allAdoptGoods: goods,
        activeAdoptGoodsCategoryId: 'all',
        adoptGoodsDisplayList: filterAdoptPlansByCategory(goods, 'all'),
      })
    } catch (error) {
      console.error('loadAdoptGoods error', error)
      this.setData({
        adoptGoodsCategories: DEFAULT_ADOPT_GOODS_CATEGORIES,
        allAdoptGoods: [],
        activeAdoptGoodsCategoryId: 'all',
        adoptGoodsDisplayList: [],
      })
    }
  },

  onAdoptionSwiperChange(e: WechatMiniprogram.SwiperChange) {
    const idx = e.detail.current
    const row = this.data.adoptions[idx]
    if (!row) return
    this.setData({
      adoptionIndex: idx,
      adoptionIndexDisplay: idx + 1,
      currentChicken: row,
    })
  },

  openChat(e?: WechatMiniprogram.TouchEvent) {
    let id = ''
    if (e && e.currentTarget && e.currentTarget.dataset) {
      const ds = e.currentTarget.dataset as WechatMiniprogram.IAnyObject
      if (ds.id != null && ds.id !== '') {
        id = String(ds.id)
      }
    }

    let chicken = this.data.currentChicken as AdoptChicken
    if (id) {
      const idx = this.data.adoptions.findIndex((item) => item.id === id)
      if (idx >= 0) {
        chicken = this.data.adoptions[idx]
        this.setData({
          adoptionIndex: idx,
          adoptionIndexDisplay: idx + 1,
          currentChicken: chicken,
        })
      }
    }

    if (!chicken || chicken.isVirtual) {
      wx.showToast({ title: '认养后才能聊天', icon: 'none' })
      return
    }

    const orderId = String(chicken.id || '')
    let messages = loadLocalChatRows(orderId)
    if (!messages.length) {
      messages = [buildWelcomeMessage(chicken.name || '小鸡')]
      saveLocalChatRows(orderId, messages)
    }
    const lastMessage = messages[messages.length - 1]

    this.setData({
      chatVisible: true,
      chatOrderId: orderId,
      chatMessages: messages,
      chatInput: '',
      chatSending: false,
      chatScrollIntoView: lastMessage ? `msg-${lastMessage.id}` : '',
      chatTeaserText: pickChatTeaserText(),
    })
  },

  closeChat() {
    this.setData({ chatVisible: false, chatSending: false })
  },

  onChatInput(e: WechatMiniprogram.Input) {
    this.setData({ chatInput: e.detail.value })
  },

  async sendChat() {
    const text = (this.data.chatInput || '').trim()
    if (!text || this.data.chatSending) return

    const orderId = String(this.data.chatOrderId || (this.data.currentChicken && this.data.currentChicken.id) || '')
    if (!orderId) {
      wx.showToast({ title: '认养档案不存在', icon: 'none' })
      return
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text }
    const afterUser = [...this.data.chatMessages, userMsg]
    saveLocalChatRows(orderId, afterUser)
    this.setData({
      chatMessages: afterUser,
      chatInput: '',
      chatSending: true,
      chatScrollIntoView: 'chat-loading-anchor',
    })

    try {
      const resp = (await createAdoptChatMessage({
        adoptOrderId: orderId,
        message: text,
        history: buildChatHistoryPayload(this.data.chatMessages),
      })) as Record<string, any>

      if (Number(resp.code) !== 200) {
        throw new Error(String(resp.msg || '聊天失败，请稍后重试'))
      }

      const data = (resp.data || {}) as Record<string, any>
      const replyText = String(data.reply || '').trim()
      if (!replyText) {
        throw new Error('聊天失败，请稍后重试')
      }

      const reply: ChatMessage = {
        id: `c-${Date.now()}`,
        role: 'chicken',
        text: replyText,
      }
      const finalMessages = [...afterUser, reply]
      saveLocalChatRows(orderId, finalMessages)
      this.setData({
        chatMessages: finalMessages,
        chatSending: false,
        chatScrollIntoView: `msg-${reply.id}`,
      })
    } catch (error) {
      console.error('sendChat error', error)
      this.setData({
        chatSending: false,
        chatScrollIntoView: `msg-${userMsg.id}`,
      })
      wx.showToast({
        title: error instanceof Error ? error.message || '聊天失败，请稍后重试' : '聊天失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  async onMonitorTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    if (!id || id === 'empty') {
      wx.showToast({ title: '暂无认养档案', icon: 'none' })
      return
    }
    const current = (this.data.adoptions || []).find((item) => String(item.id) === id)
    if (!current || current.isVirtual) {
      wx.showToast({ title: '暂无认养档案', icon: 'none' })
      return
    }
    if (!current.monitorCameraId || !current.canViewMonitor) {
      wx.showToast({ title: '暂无绑定摄像头', icon: 'none' })
      return
    }
    this.setData({
      monitorVisible: true,
      monitorLoading: true,
      monitorReady: false,
      monitorStarted: false,
      monitorErrorText: '',
      monitorTitle: current.name || current.monitorCameraName || '农场实时画面',
      monitorAccessToken: '',
      monitorPlayUrl: '',
    })
    try {
      const resp = (await getAdoptOrderMonitorPlayInfo(id)) as Record<string, any>
      if (Number(resp.code) !== 200) {
        this.setData({ monitorErrorText: String(resp.msg || '监控加载失败') })
        return
      }
      const data = (resp.data || {}) as Record<string, any>
      const accessToken = String(data.accessToken || data.access_token || '').trim()
      const playUrl = String(data.playUrl || data.play_url || data.url || '').trim()
      if (!accessToken || !playUrl) {
        this.setData({ monitorErrorText: '监控播放信息不完整' })
        return
      }
      this.setData({
        monitorTitle: String(data.title || data.cameraName || data.camera_name || current.name || '农场实时画面'),
        monitorAccessToken: accessToken,
        monitorPlayUrl: playUrl,
        monitorReady: true,
        monitorStarted: false,
      })
    } catch (error) {
      console.error('load adopt monitor error', error)
      this.setData({ monitorErrorText: '监控加载失败，请稍后重试' })
    } finally {
      this.setData({ monitorLoading: false })
    }
  },

  closeMonitor() {
    this.setData({
      monitorVisible: false,
      monitorReady: false,
      monitorStarted: false,
      monitorAccessToken: '',
      monitorPlayUrl: '',
      monitorErrorText: '',
    })
  },

  async onGiftStatTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    if (!id || id === 'empty') {
      wx.showToast({ title: '暂无认养档案', icon: 'none' })
      return
    }
    const current = (this.data.adoptions || []).find((item) => String(item.id) === id)
    if (!current || current.isVirtual) {
      wx.showToast({ title: '暂无认养档案', icon: 'none' })
      return
    }

    this.setData({
      giftVisible: true,
      giftLoading: true,
      giftDetailMode: false,
      giftSelected: null,
      giftPanelTitle: `${current.name || '认养宝贝'}的赠送记录`,
      giftList: current.giftShipments || [],
    })

    try {
      const resp = (await getAdoptGiftShipments(id, 1, 50)) as Record<string, any>
      const payload = (resp.data || {}) as Record<string, any>
      const rows = Array.isArray(payload.list) ? payload.list : []
      if (Number(resp.code) === 200) {
        const list = normalizeGiftShipments(rows)
        this.setData({ giftList: list })
      }
    } catch (error) {
      console.error('load adopt gift shipments error', error)
    } finally {
      this.setData({ giftLoading: false })
    }
  },

  closeGiftPanel() {
    this.setData({
      giftVisible: false,
      giftLoading: false,
      giftDetailMode: false,
      giftSelected: null,
    })
  },

  openGiftDetail(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    const item = (this.data.giftList || []).find((row) => String(row.id) === id)
    if (!item) return
    this.setData({
      giftDetailMode: true,
      giftSelected: item,
    })
  },

  backGiftList() {
    this.setData({
      giftDetailMode: false,
      giftSelected: null,
    })
  },

  startMonitorPlay() {
    if (!this.data.monitorReady || this.data.monitorStarted) return
    this.setData({ monitorStarted: true })
    setTimeout(() => {
      const player = this.selectComponent('#adoptMonitorPlayer') as WechatMiniprogram.Component.TrivialInstance & {
        play?: () => void
      }
      if (player && typeof player.play === 'function') {
        try {
          player.play()
        } catch (error) {
          console.error('start adopt monitor play failed', error)
          this.setData({ monitorStarted: false })
          wx.showToast({ title: '播放失败，请重试', icon: 'none' })
        }
      }
    }, 80)
  },

  onAdoptGoodsCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    if (!id) return

    this.setData({
      activeAdoptGoodsCategoryId: id,
      adoptGoodsDisplayList: filterAdoptPlansByCategory(this.data.allAdoptGoods || [], id),
    })
  },

  onAdoptPlanRowTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    if (!id) return
    wx.navigateTo({ url: `/pages/adopt-detail/adopt-detail?id=${id}` })
  },

  onAdoptNowTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { id?: string }
    const id = ds.id != null && ds.id !== '' ? String(ds.id) : ''
    if (!id) return
    wx.navigateTo({ url: `/pages/adopt-detail/adopt-detail?id=${id}` })
  },
})

