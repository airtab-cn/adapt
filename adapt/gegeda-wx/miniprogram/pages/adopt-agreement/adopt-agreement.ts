import { getBaseInfo } from '../../utils/api'

const AGREEMENT_ACCEPT_KEY = 'adoptAgreementAccepted'

function pickFirst(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function parseInlineMarkdown(text: string) {
  const codeTokens: string[] = []
  let result = escapeHtml(text)

  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const token = `__CODE_TOKEN_${codeTokens.length}__`
    codeTokens.push(`<code>${escapeHtml(String(code))}</code>`)
    return token
  })
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')
  result = result.replace(/_(.+?)_/g, '<em>$1</em>')

  codeTokens.forEach((html, idx) => {
    result = result.replace(`__CODE_TOKEN_${idx}__`, html)
  })
  return result
}

function markdownToHtml(markdown: string) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listMode: '' | 'ul' | 'ol' = ''
  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return
    const merged = paragraphBuffer.map((line) => parseInlineMarkdown(line)).join('<br/>')
    html.push(`<p>${merged}</p>`)
    paragraphBuffer = []
  }

  const closeList = () => {
    if (!listMode) return
    html.push(`</${listMode}>`)
    listMode = ''
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${parseInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph()
      closeList()
      html.push('<hr/>')
      continue
    }

    const ulItem = line.match(/^[-*+]\s+(.+)$/)
    if (ulItem) {
      flushParagraph()
      if (listMode !== 'ul') {
        closeList()
        listMode = 'ul'
        html.push('<ul>')
      }
      html.push(`<li>${parseInlineMarkdown(ulItem[1])}</li>`)
      continue
    }

    const olItem = line.match(/^\d+\.\s+(.+)$/)
    if (olItem) {
      flushParagraph()
      if (listMode !== 'ol') {
        closeList()
        listMode = 'ol'
        html.push('<ol>')
      }
      html.push(`<li>${parseInlineMarkdown(olItem[1])}</li>`)
      continue
    }

    const quote = line.match(/^>\s+(.+)$/)
    if (quote) {
      flushParagraph()
      closeList()
      html.push(`<blockquote>${parseInlineMarkdown(quote[1])}</blockquote>`)
      continue
    }

    closeList()
    paragraphBuffer.push(line)
  }

  flushParagraph()
  closeList()
  return html.join('')
}

Page({
  data: {
    title: '\u8ba4\u517b\u534f\u8bae',
    subTitle: '\u8bf7\u4ed4\u7ec6\u9605\u8bfb\u4ee5\u4e0b\u6761\u6b3e',
    headTitle: '\u534f\u8bae\u6b63\u6587',
    heroMetaLeft: '\u5e73\u53f0\u5b98\u65b9\u6587\u6863',
    heroMetaSeparator: '\u00b7',
    heroMetaRight: '\u4fdd\u969c\u53cc\u65b9\u6743\u76ca',
    footerHint: '\u9605\u8bfb\u5b8c\u6210\u540e\u53ef\u8fd4\u56de\u4e0a\u4e00\u9875',
    ackText: '\u6211\u77e5\u9053\u4e86',
    agreedText: '\u5df2\u540c\u610f',
    emptyText: '\u6682\u65e0\u534f\u8bae\u5185\u5bb9',
    content: '',
    markdownHtml: '',
    loading: true,
    loadError: false,
    agreed: false,
  },

  onLoad() {
    this.syncAgreeState()
    this.loadAgreement()
  },

  syncAgreeState() {
    let agreed = false
    try {
      agreed = !!wx.getStorageSync(AGREEMENT_ACCEPT_KEY)
    } catch (_) {
      agreed = false
    }
    this.setData({
      agreed,
      ackText: agreed ? this.data.agreedText : '\u6211\u77e5\u9053\u4e86',
    })
  },

  async loadAgreement() {
    this.setData({ loading: true, loadError: false })
    try {
      const resp = (await getBaseInfo()) as Record<string, unknown>
      const source = ((resp && resp.data) || resp) as Record<string, unknown>
      const base = ((source && source.data) || source) as Record<string, unknown>
      const agreementRaw = pickFirst(base, ['adoptAgreement', 'adopt_agreement'])
      const agreement = agreementRaw.trim()
      this.setData({
        content: agreement,
        markdownHtml: agreement ? markdownToHtml(agreement) : '',
      })
    } catch (error) {
      console.warn('load agreement failed:', error)
      const errorText = '\u8ba4\u517b\u534f\u8bae\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
      this.setData({
        content: errorText,
        markdownHtml: markdownToHtml(errorText),
        loadError: true,
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onAcknowledgeTap() {
    if (this.data.agreed) return
    try {
      wx.setStorageSync(AGREEMENT_ACCEPT_KEY, 1)
    } catch (_) {
      /* ignore */
    }
    this.setData({
      agreed: true,
      ackText: this.data.agreedText,
    })
    wx.navigateBack()
  },
})
