App<IAppOption>({
  globalData: {
    mallPrefFilterTag: '',
  },
  onLaunch() {
    try {
      const plugin = requirePlugin('ezplayer')
      plugin.setConfig({
        debug: false,
      })
    } catch (_) {
      /* 插件只在真机/预览环境完整可用，初始化失败不影响其他页面。 */
    }
  },
})
