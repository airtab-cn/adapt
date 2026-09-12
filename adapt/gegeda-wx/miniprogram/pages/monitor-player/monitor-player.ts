import { getMonitorPlayInfo } from '../../utils/api'

function getPayload(resp: Record<string, unknown>) {
  const first = resp && resp.data ? resp.data : resp
  const second = first && typeof first === 'object' && (first as Record<string, unknown>).data ? (first as Record<string, unknown>).data : first
  return second as Record<string, unknown>
}

function text(value: unknown, fallback = '') {
  const result = String(value || '').trim()
  return result || fallback
}

function protocolText(value: unknown) {
  const protocol = String(value || '').toLowerCase()
  const map: Record<string, string> = {
    ezopen: '实时画面',
    hls: '实时画面',
    flv: '实时画面',
    rtmp: '实时画面',
  }
  return map[protocol] || '实时画面'
}

function formatNow() {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    id: '',
    areaId: '',
    name: '实时监控',
    cameraNo: '',
    areaNameText: '农场区域',
    protocolLabel: '实时直播',
    loading: true,
    ready: false,
    accessToken: '',
    playUrl: '',
    verifyCode: '',
    playerPlugins: '',
    playerTheme: {
      showCapture: false,
      showBottomBar: false,
      showDatePicker: false,
      showTypeSwitch: false,
      showPlayBtn: true,
      showFullScreenBtn: true,
      showHdBtn: true,
      showVoiceBtn: false,
    },
    cover: '',
    loadedAt: '--:--',
    errorText: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = String(options.id || '')
    const areaId = String(options.areaId || options.area_id || '')
    const name = options.name ? decodeURIComponent(String(options.name)) : '实时监控'
    this.setData({ id, areaId, name })
    wx.setNavigationBarTitle({ title: name })
    if (!id) {
      this.setData({ loading: false, errorText: '摄像头不存在' })
      return
    }
    this.loadPlayInfo()
  },

  async loadPlayInfo() {
    this.setData({ loading: true, ready: false, errorText: '' })
    try {
      const resp = (await getMonitorPlayInfo(this.data.id, this.data.areaId)) as Record<string, unknown>
      if (Number(resp.code || 0) !== 200) {
        this.setData({ errorText: String(resp.msg || '监控地址获取失败') })
        return
      }
      const data = getPayload(resp)
      const accessToken = text(data.accessToken || data.access_token)
      const playUrl = text(data.playUrl || data.play_url || data.url)
      if (!accessToken || !playUrl) {
        this.setData({ errorText: '监控播放信息不完整' })
        return
      }
      const nextAreaName = text(data.areaNameText || data.area_name_text, this.data.name)
      const nextName = text(nextAreaName, this.data.name)
      wx.setNavigationBarTitle({ title: nextName })
      this.setData({
        name: nextName,
        cameraNo: text(data.cameraNo || data.camera_no, 'CAM'),
        areaNameText: nextAreaName,
        protocolLabel: protocolText(data.protocol),
        accessToken,
        playUrl,
        verifyCode: text(data.verifyCode || data.verify_code),
        cover: text(data.displayCover || data.display_cover || data.cover || data.areaCover || data.area_cover),
        loadedAt: formatNow(),
        ready: true,
      })
    } catch (error) {
      console.error('load monitor play info failed', error)
      this.setData({ errorText: '监控加载失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRetryTap() {
    this.loadPlayInfo()
  },

  onPlayerError(e: WechatMiniprogram.CustomEvent) {
    console.error('ezviz player error', e.detail)
    this.setData({ errorText: '播放器连接失败，请检查摄像头配置或萤石权限' })
    wx.showToast({ title: '播放失败，请检查配置', icon: 'none' })
  },

  handleError(e: WechatMiniprogram.CustomEvent) {
    console.error('ezviz handleError', e.detail)
    const detail = (e.detail || {}) as Record<string, unknown>
    const message = String(detail.msg || detail.message || '监控画面连接失败')
    this.setData({ ready: false, errorText: message })
    wx.showToast({ title: message, icon: 'none' })
  },

  onControlEvent(e: WechatMiniprogram.CustomEvent) {
    console.log('ezviz control event', e.detail)
  },
})
