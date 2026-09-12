import { deleteAddress, ensureMiniLogin, getAddressList, updateAddress } from '../../utils/api'

interface AddressItem {
  id: number
  name: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
}

const ADDRESS_MAX = 10

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

Page({
  data: {
    list: [] as AddressItem[],
    maxCount: ADDRESS_MAX,
    loading: false,
    selectable: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({ selectable: query.select === '1' })
  },

  async onShow() {
    const ok = await this.ensureLogin()
    if (!ok) return
    await this.loadList()
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

  async loadList() {
    this.setData({ loading: true })
    try {
      const resp = (await getAddressList()) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '获取地址失败'), icon: 'none' })
        return
      }
      const rows = Array.isArray(resp.data) ? resp.data : []
      this.setData({ list: rows.map((item) => toAddressRow(item as Record<string, unknown>)) })
    } catch (_) {
      wx.showToast({ title: '获取地址失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onAddTap() {
    if (this.data.list.length >= ADDRESS_MAX) {
      wx.showToast({ title: `最多添加${ADDRESS_MAX}个地址`, icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/address-edit/address-edit' })
  },

  onEditTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number((e.currentTarget.dataset as { id?: number | string }).id || 0)
    if (!id) return
    wx.navigateTo({ url: `/pages/address-edit/address-edit?id=${id}` })
  },

  onDeleteTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number((e.currentTarget.dataset as { id?: number | string }).id || 0)
    if (!id) return
    wx.showModal({
      title: '删除地址',
      content: '确定删除这个地址吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const resp = (await deleteAddress(id)) as Record<string, unknown>
          if (Number(resp.code) !== 200) {
            wx.showToast({ title: String(resp.msg || '删除失败'), icon: 'none' })
            return
          }
          wx.showToast({ title: '删除成功', icon: 'success' })
          await this.loadList()
        } catch (_) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  },

  async onSetDefaultTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number((e.currentTarget.dataset as { id?: number | string }).id || 0)
    if (!id) return
    try {
      const resp = (await updateAddress({ id, isDefault: true })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '设置失败'), icon: 'none' })
        return
      }
      wx.showToast({ title: '已设为默认地址', icon: 'success' })
      await this.loadList()
    } catch (_) {
      wx.showToast({ title: '设置失败', icon: 'none' })
    }
  },

  onSelectTap(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.selectable) return
    const id = Number((e.currentTarget.dataset as { id?: number | string }).id || 0)
    if (!id) return
    const row = this.data.list.find((item) => item.id === id)
    if (!row) return
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.emit('addressSelected', row)
    wx.navigateBack()
  },
})
