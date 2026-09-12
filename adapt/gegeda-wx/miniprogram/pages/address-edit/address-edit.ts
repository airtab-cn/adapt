import { createAddress, ensureMiniLogin, getAddressList, updateAddress } from '../../utils/api'

interface AddressItem {
  id: number
  name: string
  phone: string
  region: string
  regionParts: [string, string, string]
  detail: string
  isDefault: boolean
}

const ADDRESS_MAX = 10

function normalizePhone(value: string): string {
  return String(value || '').replace(/\s+/g, '')
}

function isValidMainlandPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value))
}

function toAddressRow(item: Record<string, unknown>): AddressItem {
  const province = String(item.province || '')
  const city = String(item.city || '')
  const district = String(item.district || '')
  const regionParts: [string, string, string] = [province, city, district]
  const region = String(item.region || regionParts.filter(Boolean).join(' '))
  return {
    id: Number(item.id || 0),
    name: String(item.receiverName || item.receiver_name || item.name || ''),
    phone: String(item.phone || ''),
    region,
    regionParts,
    detail: String(item.detail || ''),
    isDefault: !!(item.isDefault || item.is_default),
  }
}

Page({
  data: {
    id: 0,
    name: '',
    phone: '',
    region: '',
    regionParts: ['', '', ''] as [string, string, string],
    detail: '',
    isDefault: false,
    isEdit: false,
  },

  async onLoad(query: Record<string, string | undefined>) {
    const id = Number(query.id || 0)
    this.setData({
      id,
      isEdit: id > 0,
    })
    const ok = await this.ensureLogin()
    if (!ok) return
    if (id > 0) {
      await this.loadEditData(id)
    }
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

  async loadEditData(id: number) {
    try {
      const resp = (await getAddressList()) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '地址加载失败'), icon: 'none' })
        return
      }
      const rows = Array.isArray(resp.data) ? resp.data : []
      const hit = rows.find((item) => Number((item as Record<string, unknown>).id || 0) === id) as
        | Record<string, unknown>
        | undefined
      if (!hit) {
        wx.showToast({ title: '地址不存在', icon: 'none' })
        return
      }
      const row = toAddressRow(hit)
      this.setData({
        id: row.id,
        name: row.name,
        phone: row.phone,
        region: row.region,
        regionParts: row.regionParts,
        detail: row.detail,
        isDefault: row.isDefault,
        isEdit: true,
      })
    } catch (_) {
      wx.showToast({ title: '地址加载失败', icon: 'none' })
    }
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value || '' })
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: normalizePhone(e.detail.value || '') })
  },

  onRegionChange(e: WechatMiniprogram.CustomEvent) {
    const arr = ((e.detail as { value?: string[] }).value || []) as string[]
    const regionParts: [string, string, string] = [arr[0] || '', arr[1] || '', arr[2] || '']
    const region = regionParts.filter(Boolean).join(' ')
    this.setData({ region, regionParts })
  },

  onDetailInput(e: WechatMiniprogram.Input) {
    this.setData({ detail: e.detail.value || '' })
  },

  onDefaultChange(e: WechatMiniprogram.CustomEvent) {
    const value = !!(e.detail as { value?: boolean }).value
    this.setData({ isDefault: value })
  },

  async onSave() {
    const name = this.data.name.trim()
    const phone = normalizePhone(this.data.phone)
    const region = this.data.region.trim()
    const detail = this.data.detail.trim()
    const regionParts = this.data.regionParts || ['', '', '']
    const province = String(regionParts[0] || '').trim()
    const city = String(regionParts[1] || '').trim()
    const district = String(regionParts[2] || '').trim()

    if (!name) {
      wx.showToast({ title: '请填写收货人', icon: 'none' })
      return
    }
    if (!isValidMainlandPhone(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!region || !province || !city || !district) {
      wx.showToast({ title: '请选择省市区', icon: 'none' })
      return
    }
    if (!detail) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' })
      return
    }

    try {
      if (!this.data.isEdit) {
        const listResp = (await getAddressList()) as Record<string, unknown>
        const rows = Array.isArray(listResp.data) ? listResp.data : []
        if (rows.length >= ADDRESS_MAX) {
          wx.showToast({ title: `最多添加${ADDRESS_MAX}个地址`, icon: 'none' })
          return
        }
      }

      const payload = {
        id: this.data.id,
        receiverName: name,
        phone,
        province,
        city,
        district,
        detail,
        isDefault: this.data.isDefault,
      }

      const resp = this.data.isEdit
        ? ((await updateAddress(payload)) as Record<string, unknown>)
        : ((await createAddress(payload)) as Record<string, unknown>)

      if (Number(resp.code) !== 200) {
        wx.showToast({ title: String(resp.msg || '保存失败'), icon: 'none' })
        return
      }

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 320)
    } catch (_) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },
})
