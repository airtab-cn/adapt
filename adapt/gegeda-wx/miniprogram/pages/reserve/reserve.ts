import { createReservation, getReservationRecords, requestSubscribeMessageForScenes } from '../../utils/api'

interface ReserveRecord {
  id: number | string
  date: string
  time: string
  people: number
  purpose: string
  name: string
  phone: string
  status: 'pending' | 'approved' | 'rejected'
  maskedName: string
  maskedPhone: string
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function todayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function currentTime(): string {
  const now = new Date()
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function splitDateTime(text: string): { date: string; time: string } {
  const raw = String(text || '').trim().replace('T', ' ')
  const [date = '', timeWithSec = ''] = raw.split(' ')
  const time = timeWithSec ? timeWithSec.slice(0, 5) : ''
  return { date, time }
}

function toRecord(item: Record<string, unknown>): ReserveRecord {
  const visitTime = String(item.visitTime || item.visit_time || '')
  const parts = splitDateTime(visitTime)
  return {
    id: item.id ? String(item.id) : '',
    date: parts.date,
    time: parts.time,
    people: Number(item.people || 0),
    purpose: String(item.purpose || ''),
    name: String(item.contactName || item.contact_name || ''),
    phone: String(item.phone || ''),
    status: (item.status as 'pending' | 'approved' | 'rejected') || 'pending',
    maskedName: String(item.maskedName || item.masked_name || item.contactName || item.contact_name || ''),
    maskedPhone: String(item.maskedPhone || item.masked_phone || item.phone || ''),
  }
}

function normalizePhone(value: string): string {
  return String(value || '').replace(/\s+/g, '')
}

function isValidMainlandPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value))
}

function normalizeSubmitErrorMessage(message: string): string {
  const text = String(message || '').trim()
  if (!text || /^[?\s]+$/.test(text)) return '\u60a8\u4eca\u5929\u5df2\u6709\u9884\u7ea6\u7533\u8bf7\uff0c\u8bf7\u52ff\u91cd\u590d\u63d0\u4ea4'
  return text
}

Page({
  data: {
    minDate: todayDate(),
    date: todayDate(),
    time: currentTime(),
    people: '2',
    purposeOptions: ['\u8ba4\u517b\u54a8\u8be2', '\u519c\u573a\u63a2\u8bbf', '\u56e2\u8d2d\u6d3d\u8c08', '\u6d3b\u52a8\u62a5\u540d'],
    purposeIndex: 0,
    name: '',
    phone: '',

    records: [] as ReserveRecord[],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loadingMore: false,
    submitting: false,
    total: 0,
  },

  onLoad() {
    this.loadRecords(true)
  },

  onReachBottom() {
    this.loadRecords(false)
  },

  onPullDownRefresh() {
    this.loadRecords(true).finally(() => wx.stopPullDownRefresh())
  },

  onDateChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ date: String((e.detail as { value?: string }).value || this.data.date) })
  },

  onTimeChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ time: String((e.detail as { value?: string }).value || this.data.time) })
  },

  onPeopleInput(e: WechatMiniprogram.Input) {
    this.setData({ people: e.detail.value || '' })
  },

  onPurposeChange(e: WechatMiniprogram.CustomEvent) {
    const idx = Number((e.detail as { value?: string | number }).value)
    this.setData({ purposeIndex: Number.isNaN(idx) ? 0 : idx })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value || '' })
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: normalizePhone(e.detail.value || '') })
  },

  async loadRecords(reset = false) {
    if (this.data.loadingMore) return
    if (!reset && !this.data.hasMore) return

    const nextPage = reset ? 1 : this.data.page + 1
    this.setData({ loadingMore: true })
    try {
      const resp = (await getReservationRecords(nextPage, this.data.pageSize)) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        throw new Error(String(resp.msg || '\u63a5\u53e3\u8fd4\u56de\u5931\u8d25'))
      }
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const data = ((source && source.data) || source) as Record<string, unknown>
      const list = Array.isArray(data.list) ? data.list : []
      const mapped = list.map((item) => toRecord(item as Record<string, unknown>))
      const records = reset ? mapped : [...this.data.records, ...mapped]
      this.setData({
        records,
        page: Number(data.page || nextPage),
        hasMore: !!data.hasMore,
        total: Number(data.total || records.length),
      })
    } catch (error) {
      console.warn('load reservation records failed:', error)
      if (reset) {
        this.setData({ records: [], page: 1, hasMore: false, total: 0 })
      }
      wx.showToast({ title: '\u52a0\u8f7d\u9884\u7ea6\u8bb0\u5f55\u5931\u8d25', icon: 'none' })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  async submitReserve() {
    if (this.data.submitting) return

    const name = (this.data.name || '').trim()
    const phone = normalizePhone(this.data.phone || '')
    const peopleNum = Number(this.data.people)

    if (!name) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u9884\u7ea6\u4eba', icon: 'none' })
      return
    }
    if (!isValidMainlandPhone(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!Number.isInteger(peopleNum) || peopleNum <= 0) {
      wx.showToast({ title: '\u4eba\u6570\u9700\u4e3a\u6b63\u6574\u6570', icon: 'none' })
      return
    }

    const purpose = this.data.purposeOptions[this.data.purposeIndex] || this.data.purposeOptions[0]
    this.setData({ submitting: true })
    try {
      const resp = (await createReservation({
        visitTime: `${this.data.date} ${this.data.time}:00`,
        people: peopleNum,
        purpose,
        contactName: name,
        phone,
      })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        throw new Error(String(resp.msg || '\u63a5\u53e3\u8fd4\u56de\u5931\u8d25'))
      }
      await requestSubscribeMessageForScenes(['reservation_approved'])
      wx.showToast({ title: '\u9884\u7ea6\u63d0\u4ea4\u6210\u529f', icon: 'success' })
      this.setData({
        people: '2',
        purposeIndex: 0,
        name: '',
        phone: '',
      })
      await this.loadRecords(true)
    } catch (error) {
      console.warn('submit reservation failed:', error)
      const rawMsg = error instanceof Error && error.message ? error.message : '\u9884\u7ea6\u63d0\u4ea4\u5931\u8d25'
      const msg = normalizeSubmitErrorMessage(rawMsg)
      wx.showToast({ title: msg.slice(0, 20), icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
