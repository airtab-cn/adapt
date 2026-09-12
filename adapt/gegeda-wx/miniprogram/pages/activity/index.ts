interface ActivityItem {
  id: string
  title: string
  subtitle: string
  tag: string
  date: string
  status: '进行中' | '即将开始'
  cover: string
}

Page({
  data: {
    bannerTitle: '农场活动中心',
    bannerSub: '新客福利、节气活动、探访计划都在这里',
    activities: [
      {
        id: 'act1',
        title: '春日认养礼',
        subtitle: '下单认养赠鲜蛋券与探访优先名额',
        tag: '新客福利',
        date: '04.01 - 04.30',
        status: '进行中',
        cover: '/images/ad.jpg',
      },
      {
        id: 'act2',
        title: '周末农场开放日',
        subtitle: '报名入场可体验喂养、捡蛋与溯源讲解',
        tag: '线下活动',
        date: '每周六 09:30',
        status: '进行中',
        cover: '/images/ad.jpg',
      },
      {
        id: 'act3',
        title: '母亲节礼盒预售',
        subtitle: '礼盒组合提前锁价，支持定时发货',
        tag: '节日专场',
        date: '05.01 开始',
        status: '即将开始',
        cover: '/images/ad.jpg',
      },
    ] as ActivityItem[],
    rules: [
      '活动名额与福利数量有限，先到先得。',
      '不同活动的使用门槛和时效以活动详情为准。',
      '如遇不可抗力，平台有权调整活动时间和规则。',
    ],
  },

  onActivityTap(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    wx.showToast({ title: '活动详情开发中', icon: 'none' })
  },
})
