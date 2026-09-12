import { getActivityMessages, getHomeActivities } from '../../utils/api'

interface ActivityItem {
  id: string
  name: string
  description: string
  highlights: string
  tags: string[]
  eventTime: string
  status: 'ongoing' | 'upcoming' | 'ended'
  statusText: string
  cover: string
}

interface MessageItem {
  id: string
  activityName: string
  userName: string
  content: string
  createTime: string
}

function splitTags(text: string): string[] {
  if (!text) return []
  return text
    .split(/[，,|]/g)
    .map((s) => s.trim())
    .filter((s) => !!s)
}

function statusText(status: string): string {
  if (status === 'ongoing') return '进行中'
  if (status === 'ended') return '已结束'
  return '即将开始'
}

Page({
  data: {
    bannerTitle: '农场活动中心',
    bannerSub: '新客福利、节气活动、探访计划都在这里',
    activities: [] as ActivityItem[],
    messageBoard: [] as MessageItem[],
    rules: [
      '活动名额与福利数量有限，先到先得。',
      '不同活动的使用门槛和时效以活动详情为准。',
      '如遇不可抗力，平台有权调整活动时间和规则。',
    ],
  },

  onLoad() {
    this.loadActivities()
    this.loadMessages()
  },

  async loadActivities() {
    try {
      const resp = (await getHomeActivities()) as Record<string, unknown>
      const root = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (root && root.data) || root
      const list = Array.isArray(listData) ? listData : []

      const activities: ActivityItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const id = String(item.id || `a-${i + 1}`)
        const name = String(item.name || '')
        if (!name) continue

        const status = String(item.status || 'upcoming') as 'ongoing' | 'upcoming' | 'ended'
        activities.push({
          id,
          name,
          description: String(item.description || ''),
          highlights: String(item.highlights || ''),
          tags: splitTags(String(item.tags || '')),
          eventTime: String(item.eventTime || item.event_time || ''),
          status,
          statusText: statusText(status),
          cover: String(item.cover || ''),
        })
      }
      this.setData({ activities })
    } catch (error) {
      console.warn('load activities failed:', error)
      this.setData({ activities: [] })
    }
  },

  async loadMessages() {
    try {
      const resp = (await getActivityMessages()) as Record<string, unknown>
      const root = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const listData = (root && root.data) || root
      const list = Array.isArray(listData) ? listData : []

      const messageBoard: MessageItem[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const content = String(item.content || '').trim()
        if (!content) continue
        messageBoard.push({
          id: String(item.id || `m-${i + 1}`),
          activityName: String(item.activityName || item.activity_name || ''),
          userName: String(item.userName || item.user_name || '匿名用户'),
          content,
          createTime: String(item.createTime || item.create_time || ''),
        })
      }

      this.setData({ messageBoard })
    } catch (error) {
      console.warn('加载留言失败:', error)
    }
  },

  onActivityTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    wx.showToast({ title: '活动详情开发中', icon: 'none' })
  },
})
