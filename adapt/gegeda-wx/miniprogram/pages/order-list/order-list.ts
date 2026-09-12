import { getMallOrderList, type MallOrder } from '../../utils/api'

type OrderTabType =
  | 'all'
  | 'unpaid'
  | 'unshipped'
  | 'unreceived'
  | 'pending_review'
  | 'completed'
  | 'aftersale'
  | 'returning'
  | 'pending_refund'
  | 'aftersale_done'

interface OrderTab {
  id: OrderTabType
  label: string
}

const TABS: OrderTab[] = [
  { id: 'all', label: '全部' },
  { id: 'unpaid', label: '待付款' },
  { id: 'unshipped', label: '待发货' },
  { id: 'unreceived', label: '待收货' },
  { id: 'pending_review', label: '待评价' },
  { id: 'completed', label: '已完成' },
  { id: 'aftersale', label: '售后中' },
  { id: 'returning', label: '退货中' },
  { id: 'pending_refund', label: '待退款' },
  { id: 'aftersale_done', label: '售后完成' },
]

Page({
  data: {
    tabs: TABS,
    activeTab: 'all' as OrderTabType,
    list: [] as MallOrder[],
  },

  onLoad(query: Record<string, string | undefined>) {
    const tab = query.tab as OrderTabType | undefined
    const valid = tab && TABS.some((item) => item.id === tab) ? tab : 'all'
    this.setData({ activeTab: valid })
  },

  onShow() {
    this.fetchList()
  },

  async fetchList() {
    try {
      const resp = (await getMallOrderList(this.data.activeTab)) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '获取订单失败'), icon: 'none' })
        return
      }
      const rows = Array.isArray(resp.data) ? (resp.data as MallOrder[]) : []
      this.setData({ list: rows })
    } catch (_) {
      wx.showToast({ title: '获取订单失败', icon: 'none' })
    }
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset as { id?: OrderTabType }).id
    if (!tab || tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.fetchList()
  },

  onOrderTap(e: WechatMiniprogram.TouchEvent) {
    const orderNo = String((e.currentTarget.dataset as { no?: string }).no || '')
    if (!orderNo) return
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?orderNo=${encodeURIComponent(orderNo)}`,
    })
  },
})
