import { getMonitorAreas, getMonitorCameras } from '../../utils/api'

interface MonitorAreaItem {
  id: string
  name: string
  cover: string
  remark: string
  cameraCount: number
  active: boolean
}

interface MonitorCameraItem {
  id: string
  cameraNo: string
  name: string
  title: string
  cover: string
  areaNameText: string
  statusText: string
  statusClass: string
  description: string
  remark: string
}

const DEFAULT_COVER = '/images/ad.jpg'

function getPayload(resp: Record<string, unknown>) {
  const first = resp && resp.data ? resp.data : resp
  const second = first && typeof first === 'object' && (first as Record<string, unknown>).data ? (first as Record<string, unknown>).data : first
  return second
}

function text(value: unknown, fallback = '') {
  const result = String(value || '').trim()
  return result || fallback
}

function numberValue(value: unknown, fallback = 0) {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

function formatNow() {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toArea(item: Record<string, unknown>, activeId: string): MonitorAreaItem {
  const id = text(item.id)
  return {
    id,
    name: text(item.name, '未命名区域'),
    cover: text(item.cover),
    remark: text(item.remark),
    cameraCount: numberValue(item.cameraCount || item.camera_count, 0),
    active: id === activeId,
  }
}

function toCamera(item: Record<string, unknown>, areaCover = '', areaName = '', areaRemark = ''): MonitorCameraItem {
  const enabled = item.isEnabled === false || item.is_enabled === false ? false : true
  const cover = text(areaCover, DEFAULT_COVER)
  const currentAreaName = text(areaName || item.areaNameText || item.area_name_text, '监控区域')
  const currentDescription = text(areaRemark || item.areaRemark || item.area_remark, '点击查看该区域实时画面')
  return {
    id: text(item.id),
    cameraNo: text(item.cameraNo || item.camera_no, 'CAM'),
    name: text(item.name, '未命名摄像头'),
    title: currentAreaName,
    cover,
    areaNameText: currentAreaName,
    statusText: enabled ? '实时在线' : '已停用',
    statusClass: enabled ? 'online' : 'offline',
    description: currentDescription,
    remark: text(item.remark),
  }
}

Page({
  data: {
    loading: false,
    areaLoading: false,
    activeAreaId: '',
    activeAreaName: '监控区域',
    activeAreaCover: '',
    activeAreaRemark: '',
    areas: [] as MonitorAreaItem[],
    cameras: [] as MonitorCameraItem[],
    areaCount: 0,
    cameraCount: 0,
    updatedAt: '--:--',
    emptyText: '暂无可查看的监控摄像头',
  },

  onLoad() {
    this.loadAreasAndCameras()
  },

  onPullDownRefresh() {
    this.loadAreasAndCameras().finally(() => wx.stopPullDownRefresh())
  },

  async loadAreasAndCameras() {
    this.setData({ areaLoading: true })
    let activeId = this.data.activeAreaId || ''
    try {
      const resp = (await getMonitorAreas()) as Record<string, unknown>
      const payload = getPayload(resp)
      const source = Array.isArray(payload) ? payload : []
      const list: MonitorAreaItem[] = []
      let hasActiveArea = false

      for (let i = 0; i < source.length; i++) {
        const area = toArea(source[i] as Record<string, unknown>, activeId)
        if (area.id === activeId) {
          hasActiveArea = true
        }
        list.push(area)
      }

      if (!hasActiveArea && list.length > 0) {
        activeId = list[0].id
      }

      const nextAreas = list.map((item) => ({ ...item, active: item.id === activeId }))
      const activeArea = nextAreas.filter((item) => item.id === activeId)[0]
      this.setData({
        activeAreaId: activeId,
        activeAreaName: activeArea ? activeArea.name : '监控区域',
        activeAreaCover: activeArea ? activeArea.cover : '',
        activeAreaRemark: activeArea ? activeArea.remark : '',
        areas: nextAreas,
        areaCount: list.length,
      })
    } catch (error) {
      console.error('load monitor areas failed', error)
      wx.showToast({ title: '监控区域加载失败', icon: 'none' })
    } finally {
      this.setData({ areaLoading: false })
    }
    await this.loadCameras()
  },

  async loadCameras() {
    this.setData({ loading: true })
    try {
      const activeId = this.data.activeAreaId || ''
      if (!activeId) {
        this.setData({ cameras: [], cameraCount: 0, updatedAt: formatNow() })
        return
      }
      const resp = (await getMonitorCameras(activeId)) as Record<string, unknown>
      const payload = getPayload(resp)
      const source = Array.isArray(payload) ? payload : []
      const cameras: MonitorCameraItem[] = []
      const activeAreaCover = String(this.data.activeAreaCover || '')
      const activeAreaName = String(this.data.activeAreaName || '')
      const activeAreaRemark = String(this.data.activeAreaRemark || '')
      for (let i = 0; i < source.length; i++) {
        cameras.push(toCamera(source[i] as Record<string, unknown>, activeAreaCover, activeAreaName, activeAreaRemark))
      }
      this.setData({
        cameras,
        cameraCount: cameras.length,
        updatedAt: formatNow(),
      })
    } catch (error) {
      console.error('load monitor cameras failed', error)
      wx.showToast({ title: '摄像头加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onAreaTap(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    const selected = (this.data.areas || []).filter((item) => item.id === id)[0]
    const list = (this.data.areas || []).map((item) => ({ ...item, active: item.id === id }))
    this.setData({
      activeAreaId: id,
      activeAreaName: selected ? selected.name : '监控区域',
      activeAreaCover: selected ? selected.cover : '',
      activeAreaRemark: selected ? selected.remark : '',
      areas: list,
    })
    this.loadCameras()
  },

  onCameraTap(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const name = String(e.currentTarget.dataset.name || this.data.activeAreaName || '实时监控')
    const areaId = String(this.data.activeAreaId || '')
    if (!id) return
    wx.navigateTo({ url: `/pages/monitor-player/monitor-player?id=${id}&areaId=${areaId}&name=${encodeURIComponent(name)}` })
  },
})
