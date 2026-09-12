import { getHomeActivities } from '../../utils/api'

interface EventItem {
  id: string
  title: string
  subtitle: string
  tag: string
  date: string
  status: 'ongoing' | 'upcoming' | 'ended'
  statusText: string
  cover: string
  isTop: boolean
}

function parseTime(value: string): number {
  if (!value) return 0
  const normalized = value.replace(/-/g, '/').replace('T', ' ')
  const ts = new Date(normalized).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

function calcStatus(startTime: string, endTime: string): 'ongoing' | 'upcoming' | 'ended' {
  const now = Date.now()
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  if (start && now < start) return 'upcoming'
  if (end && now > end) return 'ended'
  if (start || end) return 'ongoing'
  return 'upcoming'
}

function statusText(status: string): string {
  if (status === 'ongoing') return '进行中'
  if (status === 'ended') return '已结束'
  return '即将开始'
}

function splitFirstTag(tags: string): string {
  if (!tags) return '活动'
  const parts = tags
    .split(/[，,|]/g)
    .map((s) => s.trim())
    .filter((s) => !!s)
  return parts[0] || '活动'
}

Page({
  data: {
    bannerTitle: '农场活动中心',
    bannerSub: '新客福利、节气活动、探访计划都在这里',
    events: [] as EventItem[],
  },

  onLoad() {
    this.loadEvents()
  },

  async loadEvents() {
    try {
      const resp = (await getHomeActivities()) as Record<string, unknown>
      const root = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (root && root.data) || root
      const list = Array.isArray(listData) ? listData : []

      const events: EventItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const id = String(item.id || `e-${i + 1}`)
        const title = String(item.name || '')
        if (!title) continue

        const startTime = String(item.startTime || item.start_time || '')
        const endTime = String(item.endTime || item.end_time || '')
        const status = calcStatus(startTime, endTime)
        events.push({
          id,
          title,
          subtitle: String(item.description || ''),
          tag: splitFirstTag(String(item.tags || '')),
          date: String(item.eventTime || item.event_time || `${startTime} - ${endTime}`),
          status,
          statusText: statusText(status),
          cover: String(item.cover || ''),
          isTop: !!(item.isTop !== undefined && item.isTop !== null ? item.isTop : item.is_top),
        })
      }

      events.sort((a, b) => Number(b.isTop) - Number(a.isTop))
      this.setData({ events })
    } catch (error) {
      console.warn('load events failed:', error)
      this.setData({ events: [] })
    }
  },

  onEventTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` })
  },
})
