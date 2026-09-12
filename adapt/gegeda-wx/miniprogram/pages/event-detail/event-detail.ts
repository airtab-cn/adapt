import { clearMiniAuth, createActivityMessage, ensureMiniLogin, getActivityMessages, getHomeActivityDetail } from '../../utils/api'

interface EventDetail {
  id: string
  name: string
  tags: string[]
  description: string
  highlights: string
  eventTime: string
  status: 'ongoing' | 'upcoming' | 'ended'
  statusText: string
  cover: string
}

interface EventComment {
  id: string
  nickname: string
  avatar: string
  content: string
  time: string
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
  if (status === 'ongoing') return '\u8fdb\u884c\u4e2d'
  if (status === 'ended') return '\u5df2\u7ed3\u675f'
  return '\u5373\u5c06\u5f00\u59cb'
}

function splitTags(text: string): string[] {
  if (!text) return []
  return text
    .split(/[\uff0c,|]/g)
    .map((s) => s.trim())
    .filter((s) => !!s)
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

Page({
  data: {
    i18n: {
      activityIntro: '\u6d3b\u52a8\u7b80\u4ecb',
      activityTimePrefix: '\u6d3b\u52a8\u65f6\u95f4\uff1a',
      activityHighlights: '\u6d3b\u52a8\u4eae\u70b9',
      activityRules: '\u6d3b\u52a8\u89c4\u5219',
      messageBoard: '\u6d3b\u52a8\u7559\u8a00\u677f',
      userMessage: '\u7528\u6237\u7559\u8a00',
      messagePlaceholder: '\u5199\u4e0b\u4f60\u7684\u6d3b\u52a8\u7559\u8a00...',
      submitMessage: '\u7559\u8a00',
      emptyComments: '\u6682\u65e0\u7559\u8a00\uff0c\u5feb\u6765\u62a2\u6c99\u53d1\u5427',
      loading: '\u52a0\u8f7d\u4e2d...',
      detailNotFound: '\u672a\u627e\u5230\u6d3b\u52a8\u4fe1\u606f\uff0c\u8bf7\u8fd4\u56de\u4e0a\u4e00\u9875\u91cd\u8bd5\u3002',
    },
    detail: {
      id: '',
      name: '',
      tags: [],
      description: '',
      highlights: '',
      eventTime: '',
      status: 'upcoming',
      statusText: '\u5373\u5c06\u5f00\u59cb',
      cover: '/images/ad.jpg',
    } as EventDetail,
    notFound: false,
    rules: [
      '\u6d3b\u52a8\u540d\u989d\u4e0e\u798f\u5229\u6570\u91cf\u6709\u9650\uff0c\u5148\u5230\u5148\u5f97\u3002',
      '\u4e0d\u540c\u6d3b\u52a8\u7684\u4f7f\u7528\u95e8\u69db\u548c\u65f6\u6548\u4ee5\u6d3b\u52a8\u8be6\u60c5\u4e3a\u51c6\u3002',
      '\u5982\u9047\u4e0d\u53ef\u6297\u529b\uff0c\u5e73\u53f0\u6709\u6743\u8c03\u6574\u6d3b\u52a8\u65f6\u95f4\u548c\u89c4\u5219\u3002',
    ],
    commentInput: '',
    comments: [] as EventComment[],
    commentPage: 1,
    commentPageSize: 10,
    commentsLoading: false,
    commentsFinished: false,
    commentsNoMoreText: '\u6ca1\u6709\u66f4\u591a\u4e86',
  },

  onLoad(query: Record<string, string | undefined>) {
    enableShareMenu()
    const id = query.id || ''
    if (!id) {
      this.setData({ notFound: true })
      return
    }
    this.loadDetail(id)
    this.loadComments(true, id)
  },

  onShareAppMessage() {
    const detail = this.data.detail
    const title = detail && detail.name ? `${detail.name}，这场农场活动有点意思` : '这场农场活动有点意思，周末去看看'
    const path = detail && detail.id ? `/pages/event-detail/event-detail?id=${encodeURIComponent(detail.id)}` : '/pages/event/event'
    const imageUrl = detail && detail.cover ? detail.cover : '/images/ad.jpg'
    return { title, path, imageUrl }
  },

  onShareTimeline() {
    const detail = this.data.detail
    const title = detail && detail.name ? `${detail.name}，这场农场活动有点意思` : '这场农场活动有点意思，周末去看看'
    const query = detail && detail.id ? `id=${encodeURIComponent(detail.id)}` : ''
    const imageUrl = detail && detail.cover ? detail.cover : '/images/ad.jpg'
    return { title, query, imageUrl }
  },

  async loadDetail(id: string) {
    try {
      const resp = (await getHomeActivityDetail(id)) as Record<string, unknown>
      const root = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const detailData = ((root && root.data) || root) as Record<string, unknown>
      if (!detailData || !detailData.id) {
        this.setData({ notFound: true })
        return
      }

      const startTime = String(detailData.startTime || detailData.start_time || '')
      const endTime = String(detailData.endTime || detailData.end_time || '')
      const status = calcStatus(startTime, endTime)

      const detail: EventDetail = {
        id: String(detailData.id || ''),
        name: String(detailData.name || ''),
        tags: splitTags(String(detailData.tags || '')),
        description: String(detailData.description || ''),
        highlights: String(detailData.highlights || ''),
        eventTime: String(detailData.eventTime || detailData.event_time || `${startTime} - ${endTime}`),
        status,
        statusText: statusText(status),
        cover: String(detailData.cover || '/images/ad.jpg'),
      }
      this.setData({ detail, notFound: false })
    } catch (error) {
      console.warn('load activity detail failed:', error)
      this.setData({ notFound: true })
    }
  },

  async loadComments(reset = false, activityId?: string) {
    if (this.data.commentsLoading) return

    const id = String(activityId || this.data.detail.id || '').trim()
    if (!id) return
    if (!reset && this.data.commentsFinished) return

    const nextPage = reset ? 1 : this.data.commentPage
    this.setData({ commentsLoading: true })
    try {
      const resp = (await getActivityMessages(Number(id), nextPage, this.data.commentPageSize)) as Record<string, unknown>
      const root = ((resp && (resp as Record<string, unknown>).data) || resp) as Record<string, unknown>
      const payload = ((root && root.data) || root) as Record<string, unknown>

      const listData = (payload && payload.list) || payload
      const list = Array.isArray(listData) ? listData : []

      const comments: EventComment[] = []
      for (let i = 0; i < list.length; i++) {
        const item = list[i] as Record<string, unknown>
        const content = String(item.content || '').trim()
        if (!content) continue
        comments.push({
          id: String(item.id || `c-${nextPage}-${i + 1}`),
          nickname: String(item.userName || item.user_name || '\u533f\u540d\u7528\u6237'),
          avatar: String(item.avatar || item.userAvatar || item.user_avatar || '/images/avatar.svg'),
          content,
          time: String(item.createTime || item.create_time || ''),
        })
      }

      const hasMore = Boolean(payload && payload.hasMore)
      const merged = reset ? comments : [...this.data.comments, ...comments]
      this.setData({
        comments: merged,
        commentPage: nextPage + 1,
        commentsFinished: !hasMore,
      })
    } catch (error) {
      console.warn('load activity comments failed:', error)
    } finally {
      this.setData({ commentsLoading: false })
    }
  },

  onCommentReachBottom() {
    this.loadComments(false)
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ commentInput: e.detail.value || '' })
  },

  async onSubmitComment() {
    const id = String(this.data.detail.id || '').trim()
    const content = String(this.data.commentInput || '').trim()
    if (!id) return
    if (!content) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u7559\u8a00\u5185\u5bb9', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '\u767b\u5f55\u4e2d', mask: true })
      await ensureMiniLogin()
      wx.hideLoading()

      wx.showLoading({ title: '\u63d0\u4ea4\u4e2d', mask: true })
      let resp = (await createActivityMessage({ activityId: Number(id), content })) as Record<string, unknown>
      if (Number(resp.code) === 401) {
        clearMiniAuth()
        await ensureMiniLogin()
        resp = (await createActivityMessage({ activityId: Number(id), content })) as Record<string, unknown>
      }
      if (Number(resp.code) !== 200) {
        wx.hideLoading()
        wx.showToast({ title: String(resp.msg || '\u7559\u8a00\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'), icon: 'none' })
        return
      }

      wx.hideLoading()
      this.setData({ commentInput: '' })
      await this.loadComments(true, id)
      wx.showToast({ title: '\u7559\u8a00\u6210\u529f', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      console.warn('submit comment failed:', error)
      wx.showToast({ title: '\u7559\u8a00\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5', icon: 'none' })
    }
  },
})
