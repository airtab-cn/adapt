import { claimCoupon, getCouponCenterList, type CouponRuleItem } from '../../utils/api'

Page({
  data: {
    scene: 'mall',
    sceneText: '商城',
    loading: false,
    list: [] as CouponRuleItem[],
  },

  onLoad(query: Record<string, string | undefined>) {
    const scene = String(query.scene || 'mall') === 'adopt' ? 'adopt' : 'mall'
    this.setData({ scene, sceneText: scene === 'adopt' ? '认养' : '商城' })
    this.fetchList()
  },

  async fetchList() {
    this.setData({ loading: true })
    try {
      const resp = (await getCouponCenterList(this.data.scene)) as Record<string, unknown>
      const list = Array.isArray(resp.data) ? (resp.data as CouponRuleItem[]) : []
      this.setData({ list })
    } catch (_) {
      wx.showToast({ title: '获取优惠券失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onClaimTap(e: WechatMiniprogram.TouchEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    if (!id) return
    try {
      wx.showLoading({ title: '领取中', mask: true })
      const resp = (await claimCoupon(id)) as Record<string, unknown>
      wx.hideLoading()
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '领取失败'), icon: 'none' })
        return
      }
      wx.showToast({ title: '领取成功', icon: 'success' })
      this.fetchList()
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '领取失败，请重试', icon: 'none' })
    }
  },
})
