import { getUserProfile, MINI_PROFILE_KEY, updateUserProfile, uploadAvatar } from '../../utils/api'

interface StoredProfile {
  avatar: string
  nickname: string
  userUid?: string
}

const DEFAULT_AVATAR = '/images/avatar.svg'
const DEFAULT_NICKNAME = '\u5c0f\u9e21\u9972\u517b\u5458'
const MSG_FETCH_FAIL = '\u83b7\u53d6\u7528\u6237\u4fe1\u606f\u5931\u8d25'
const MSG_NICK_EMPTY = '\u8bf7\u586b\u5199\u6635\u79f0'
const MSG_UPLOAD_FAIL = '\u5934\u50cf\u4e0a\u4f20\u5931\u8d25'
const MSG_UPDATE_FAIL = '\u8d44\u6599\u66f4\u65b0\u5931\u8d25'
const MSG_SAVED = '\u5df2\u4fdd\u5b58'
const MSG_SAVE_FAIL = '\u4fdd\u5b58\u5931\u8d25'

Page({
  data: {
    userUid: '--',
    avatar: DEFAULT_AVATAR,
    nickname: DEFAULT_NICKNAME,
    saving: false,
  },

  onLoad() {
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const resp = (await getUserProfile()) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        throw new Error(String(resp.msg || MSG_FETCH_FAIL))
      }
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const profile = ((source && source.data) || source) as Record<string, unknown>
      this.setData({
        userUid: String(profile.userUid || profile.user_uid || '--'),
        avatar: String(profile.avatar || DEFAULT_AVATAR),
        nickname: String(profile.nickname || DEFAULT_NICKNAME),
      })
    } catch (error) {
      console.warn('load profile failed:', error)
      const raw = wx.getStorageSync(MINI_PROFILE_KEY) as StoredProfile | undefined
      if (raw && typeof raw === 'object') {
        this.setData({
          userUid: String(raw.userUid || '--'),
          avatar: raw.avatar || DEFAULT_AVATAR,
          nickname: raw.nickname || DEFAULT_NICKNAME,
        })
      }
    }
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const url = (e.detail as { avatarUrl?: string }).avatarUrl
    if (url) {
      this.setData({ avatar: url })
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value || '' })
  },

  async onSave() {
    if (this.data.saving) return

    const nickname = (this.data.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: MSG_NICK_EMPTY, icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      let avatarUrl = this.data.avatar
      if (avatarUrl && !/^https?:\/\//.test(avatarUrl) && !avatarUrl.startsWith('/images/')) {
        const uploadResp = (await uploadAvatar(avatarUrl)) as Record<string, unknown>
        if (Number(uploadResp.code) !== 200) {
          throw new Error(String(uploadResp.msg || MSG_UPLOAD_FAIL))
        }
        const uploadSource = ((uploadResp && uploadResp.data) || uploadResp) as Record<string, unknown>
        const uploadData = ((uploadSource && uploadSource.data) || uploadSource) as Record<string, unknown>
        avatarUrl = String(uploadData.avatar || avatarUrl)
      }

      const resp = (await updateUserProfile({ nickname, avatar: avatarUrl })) as Record<string, unknown>
      if (Number(resp.code) !== 200) {
        throw new Error(String(resp.msg || MSG_UPDATE_FAIL))
      }

      wx.setStorageSync(MINI_PROFILE_KEY, { avatar: avatarUrl, nickname })
      wx.showToast({ title: MSG_SAVED, icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 400)
    } catch (error) {
      console.warn('save profile failed:', error)
      wx.showToast({ title: MSG_SAVE_FAIL, icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})

