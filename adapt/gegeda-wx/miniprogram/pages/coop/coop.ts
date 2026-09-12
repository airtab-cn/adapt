interface CoopTypeItem {
  id: string
  label: string
  desc: string
}

const COOP_SUBMIT_STORAGE_KEY = 'coopSubmittedOnce'

const COOP_TYPES: CoopTypeItem[] = [
  { id: 'channel', label: '渠道分销', desc: '区域代理、社区团购、企业采购供货' },
  { id: 'brand', label: '品牌联名', desc: '联名礼盒、节日活动、联合传播' },
  { id: 'group', label: '团建活动', desc: '企业团建、农场参访、亲子研学定制' },
  { id: 'custom', label: '企业采购', desc: '企业食堂、员工福利、长期稳定采购合作' },
]

function normalizePhone(value: string): string {
  return String(value || '').replace(/\s+/g, '')
}

function isValidMainlandPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value))
}

Page({
  data: {
    coopTypes: COOP_TYPES,
    activeTypeId: 'channel',
    company: '',
    contact: '',
    phone: '',
    position: '',
    demand: '',
    submitted: false,
  },

  onLoad() {
    try {
      const submitted = !!wx.getStorageSync(COOP_SUBMIT_STORAGE_KEY)
      this.setData({ submitted })
    } catch (_) {
      /* ignore */
    }
  },

  onTypeTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id || id === this.data.activeTypeId) return
    this.setData({ activeTypeId: id })
  },

  onCompanyInput(e: WechatMiniprogram.Input) {
    this.setData({ company: e.detail.value || '' })
  },

  onContactInput(e: WechatMiniprogram.Input) {
    this.setData({ contact: e.detail.value || '' })
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ phone: normalizePhone(e.detail.value || '') })
  },

  onPositionInput(e: WechatMiniprogram.Input) {
    this.setData({ position: e.detail.value || '' })
  },

  onDemandInput(e: WechatMiniprogram.Input) {
    this.setData({ demand: e.detail.value || '' })
  },

  onSubmitTap() {
    if (this.data.submitted) {
      wx.showToast({ title: '你已提交过合作意向', icon: 'none' })
      return
    }

    const company = this.data.company.trim()
    const contact = this.data.contact.trim()
    const phone = normalizePhone(this.data.phone)
    const demand = this.data.demand.trim()

    if (!company) {
      wx.showToast({ title: '请填写公司名称', icon: 'none' })
      return
    }
    if (!contact) {
      wx.showToast({ title: '请填写联系人', icon: 'none' })
      return
    }
    if (!isValidMainlandPhone(phone)) {
      wx.showToast({ title: '请填写正确手机号', icon: 'none' })
      return
    }
    if (!demand) {
      wx.showToast({ title: '请填写合作需求', icon: 'none' })
      return
    }

    wx.showToast({ title: '提交成功，我们会尽快联系', icon: 'success' })
    try {
      wx.setStorageSync(COOP_SUBMIT_STORAGE_KEY, true)
    } catch (_) {
      /* ignore */
    }

    this.setData({
      company: '',
      contact: '',
      phone: '',
      position: '',
      demand: '',
      activeTypeId: 'channel',
      submitted: true,
    })
  },

  onCallTap() {
    wx.makePhoneCall({
      phoneNumber: '4008886688',
      fail: () => wx.showToast({ title: '暂时无法拨打电话', icon: 'none' }),
    })
  },
})
