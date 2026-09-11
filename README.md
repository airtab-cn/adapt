# gegeda-wx · 认养一只鸡

基于 **微信小程序原生框架 + TypeScript** 开发的农场服务小程序，围绕「农场认养、农产品购买、农场探访」提供用户端交互，涵盖认养档案、商品商城、订单售后、实时监控、活动预约和个人资产等功能。

[English](README.en.md) · [界面预览](#界面预览) · [功能说明](#功能说明) · [快速开始](#快速开始) · [接口接入](#接口接入) · [授权说明](#授权说明) · [获取全套代码与帮助](#获取全套代码与帮助)

> 本仓库提供小程序前端源码，不包含后端服务、管理后台、数据库或业务初始化数据。**使用前须联系作者并获得明确授权**，详见[授权说明](#授权说明)。如需全套「后端服务 + Web 管理端 + 小程序」代码，可通过[微信或 QQ 联系作者](#获取全套代码与帮助)。

## 界面预览

以下截图来自仓库的 [images](images/) 目录，展示拍摄时的页面状态。商品、价格、用户资料及业务数据随接入环境变化，部分页面包含未认养或暂无数据时的展示状态。

<table>
  <tr>
    <th>首页与农场入口</th>
    <th>商品商城</th>
    <th>认养档案与方案</th>
  </tr>
  <tr>
    <td><img src="gegeda-wx/images/IMG_3912.PNG" width="240" alt="小程序首页，展示轮播图、公告和农场服务入口"></td>
    <td><img src="gegeda-wx/images/IMG_3917.PNG" width="240" alt="商品商城，展示分类、搜索和商品列表"></td>
    <td><img src="gegeda-wx/images/IMG_3918.PNG" width="240" alt="认养页面，展示未认养状态的档案、周期和认养方案"></td>
  </tr>
  <tr>
    <th>商品详情</th>
    <th>认养方案详情</th>
    <th>个人中心</th>
  </tr>
  <tr>
    <td><img src="gegeda-wx/images/IMG_3926.PNG" width="240" alt="商品详情，展示商品图片、价格、规格、优惠券和购买入口"></td>
    <td><img src="gegeda-wx/images/IMG_3930.PNG" width="240" alt="认养方案详情，展示认养周期、赠品和服务内容"></td>
    <td><img src="gegeda-wx/images/IMG_3921.PNG" width="240" alt="个人中心，展示个人资料、资产、订单状态和常用服务"></td>
  </tr>
</table>

<details>
  <summary>查看更多：规格选择、农场预约与监控中心</summary>

  <table>
    <tr>
      <th>规格与配送方式</th>
      <th>农场预约</th>
      <th>监控中心</th>
    </tr>
    <tr>
      <td><img src="gegeda-wx/images/IMG_3927.PNG" width="240" alt="商品规格弹层，展示规格、配送方式和购买数量选择"></td>
      <td><img src="gegeda-wx/images/IMG_3925.PNG" width="240" alt="农场预约页面，展示预约表单和预约记录区域"></td>
      <td><img src="gegeda-wx/images/IMG_3923.PNG" width="240" alt="农场监控中心，展示尚未配置监控区域和摄像头时的空状态"></td>
    </tr>
  </table>

</details>

## 功能说明

以下按当前前端代码梳理。表中的业务操作已包含页面交互和对应接口调用，实际结果依赖后端实现与服务配置，并不表示仓库自带这些服务。

| 模块 | 主要功能 |
| --- | --- |
| 首页 | 轮播图及跳转、公告详情、商品搜索、限时商品展示与倒计时、认养推荐、特色商品、农场视频及服务入口 |
| 商品商城 | 商品分类、推荐／热销／新品标签筛选、关键词搜索、商品详情、规格与数量选择、配送方式选择、商品收藏、评价浏览和领券入口 |
| 购物车 | 商品勾选与全选、数量调整、滑动删除、金额汇总、多商品结算；部分操作带有本地缓存回退 |
| 商城订单 | 提交订单、收货地址选择、优惠券抵扣、余额优先支付及微信补差支付、发票信息填写、订单状态筛选、待支付订单继续付款与取消、物流信息展示、确认收货 |
| 评价与售后 | 星级和图文评价、仅退款／退货退款申请、凭证图片上传、售后进度展示、退货物流信息提交 |
| 农场认养 | 认养方案分类与详情、协议阅读、认养名称与头像选择、收货信息和备注填写、优惠券与发票信息、认养下单及支付 |
| 认养档案 | 多份档案切换、脚环信息、认养状态与周期进度、已陪伴和剩余天数、赠品发货记录及详情、关联摄像头查看、互动聊天、认养海报生成与保存 |
| 农场监控 | 监控区域切换、摄像头列表、实时画面播放、加载状态与失败重试；使用 `ezplayer` 插件 |
| 活动与预约 | 活动列表、活动详情及状态、留言浏览与发布；预约日期、时间、人数、目的和联系人填写，预约记录与审核状态查询 |
| 个人中心 | 微信登录与退出、头像上传、昵称修改、订单数量提示、收货地址增删改及默认地址、收藏列表、客服入口、农场电话与地图导航 |
| 个人资产 | 余额与充值套餐、充值记录及继续付款、积分统计与明细、认养记录、优惠券领取与使用状态查看 |
| 分享与消息 | 首页、商城、商品、活动及认养相关页面分享；订单、售后、认养与预约场景的订阅消息授权申请 |

### 典型使用流程

- **购买商品**：首页／商城 → 商品详情 → 选择规格与配送方式 → 立即购买或购物车结算 → 确认订单并支付 → 查看物流 → 确认收货、评价或申请售后。
- **认养小鸡**：认养方案 → 查看方案与协议 → 填写名称、头像和收货信息 → 提交并支付 → 在认养页查看档案、周期、赠品记录及关联监控。
- **预约参观**：首页预约入口 → 填写到访信息 → 提交申请 → 在预约记录中查看审核状态。

### 当前实现范围

- **后端依赖**：商品、订单、资产、认养档案、活动、预约及监控配置等主要数据通过 HTTP 接口获取。仓库未提供可独立运行的完整离线演示模式。
- **支付与履约**：前端已接入下单、微信支付调用及支付结果确认流程；计价、余额扣减、支付校验、退款、发货和预约审核等需要后端处理。
- **互动聊天**：认养页的「和它聊聊」调用后端 `createAdoptChatMessage/` 获取回复，并在本地保存聊天记录；仓库不包含对话生成服务。
- **监控与订阅消息**：需要实际摄像头及插件权限、有效播放信息，以及后端配置的订阅消息模板。前端负责授权申请，消息发送由后端实现。
- **合作意向**：`pages/coop/coop` 已注册页面，包含表单校验及本地提交标记，尚未接入服务端提交接口；页面中的成功提示不代表已向运营方发送申请。
- **活动页面**：当前入口使用 `pages/event/event` 和 `pages/event-detail/event-detail`。`pages/activity/` 下的两套页面文件未注册到 `app.json`，不属于当前运行入口。
- **发票信息**：支持填写和随订单提交开票资料，不包含独立的开票服务。

## 技术与结构

| 项目 | 说明 |
| --- | --- |
| 开发方式 | 微信小程序原生 `App`／`Page` 与微信 API |
| 页面与样式 | WXML、WXSS，使用原生组件及自定义页面样式 |
| 业务语言 | TypeScript，由微信开发者工具的 `typescript` 编译插件处理 |
| 类型支持 | 仓库内 `typings/`；`package.json` 声明 `miniprogram-api-typings` 开发依赖 |
| 网络与上传 | `wx.request`、`wx.uploadFile`，统一封装在 `miniprogram/utils/api.ts` |
| 本地状态 | 微信 Storage，用于登录信息、购物车缓存、结算草稿及部分交互记录 |
| 播放与绘图 | 萤石 `ezplayer` 插件、微信 Canvas 海报绘制 |
| 全局配置 | `style: v2`、`componentFramework: glass-easel`、按需注入组件 |

```text
gegeda-wx/
├── images/                     # README 使用的小程序截图
├── miniprogram/                # 小程序源码根目录
│   ├── app.ts                  # 应用初始化、播放器插件初始化
│   ├── app.json                # 页面路由、TabBar、全局窗口、插件声明
│   ├── app.wxss                # 全局样式
│   ├── images/                 # 小程序运行时使用的图标和图片
│   ├── pages/                  # 业务页面，每页由 ts/json/wxml/wxss 组成
│   └── utils/
│       ├── api.ts              # 接口地址、登录鉴权、请求与业务接口封装
│       └── util.ts             # 通用工具
├── typings/                    # TypeScript 类型声明
├── package.json                # npm 元信息与开发依赖
├── project.config.json         # 公共开发者工具配置
├── project.private.config.json # 本地配置，可覆盖公共配置
├── tsconfig.json               # TypeScript 配置
├── README.md
└── README.en.md
```

### 页面索引

页面注册以 [miniprogram/app.json](gegeda-wx/miniprogram/app.json) 为准。当前包含 26 个页面，其中首页、商城、认养、购物车和「我」为底部 TabBar 页面。

下表路径均相对于 `miniprogram/pages/`。

| 业务 | 页面路径 |
| --- | --- |
| 首页与搜索 | `home/home`、`search-result/search-result` |
| 商品 | `mall/mall`、`product-detail/product-detail`、`product-review-list/product-review-list`、`favorite-list/favorite-list` |
| 购物车与订单 | `cart/cart`、`order-submit/order-submit`、`order-list/order-list`、`order-detail/order-detail` |
| 认养 | `adopt/adopt`、`adopt-detail/adopt-detail`、`adopt-order-submit/adopt-order-submit`、`adopt-agreement/adopt-agreement` |
| 资产与优惠券 | `assets-detail/assets-detail`、`coupon-center/coupon-center` |
| 个人资料与地址 | `mine/mine`、`profile-edit/profile-edit`、`address-list/address-list`、`address-edit/address-edit` |
| 活动与预约 | `event/event`、`event-detail/event-detail`、`reserve/reserve` |
| 监控 | `monitor/monitor`、`monitor-player/monitor-player` |
| 合作意向 | `coop/coop`（本地交互，尚未接入提交接口） |

## 快速开始

以下步骤适用于已获得作者授权的使用者。完整体验需要接入兼容的后端，并配置自己的小程序 AppID、支付及监控等服务。

### 1. 准备环境

- 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，准备自己的小程序 AppID 和项目开发权限。
- 如需安装 npm 开发依赖，准备 Node.js 和 npm；小程序本身在微信开发者工具中编译运行。
- 准备可访问的兼容后端。接口入口及接入约定见[接口接入](#接口接入)。

仓库公共配置的 `libVersion` 为 `trial`，私有配置为 `3.15.1`，且私有配置可覆盖公共配置。这些是仓库记录的开发配置，并非已验证的最低兼容版本；请结合自己的开发者工具、目标设备和插件要求选择基础库。

### 2. 获取源码

```bash
git clone https://gitee.com/lytcreate/gegeda-wx.git
cd gegeda-wx
npm install
```

`npm install` 安装声明的开发依赖。当前没有 npm 运行时依赖，也未提供 `npm run dev`、`npm run build` 或 `npm test` 脚本。

### 3. 导入项目

1. 打开微信开发者工具，选择「导入项目」。
2. 选择仓库根目录 `gegeda-wx`，即包含 `project.config.json` 的目录。
3. 使用自己的 AppID，确认 `project.config.json` 中的 `appid` 与导入配置一致。
4. 确认项目类型为小程序，源码目录为 `miniprogram/`，TypeScript 编译插件已启用。

仓库已有的 AppID 是原项目配置，接入自己的后端、支付及插件时应使用自己的账号配置。[项目配置规则](https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html)可查阅微信官方文档。

### 4. 设置后端地址

修改 [miniprogram/utils/api.ts](gegeda-wx/miniprogram/utils/api.ts) 顶部的 `USER_BASE_URL`。当前值为局域网调试地址 `http://192.168.3.37:8000/user/`，需要替换为自己的服务地址，例如：

```ts
export const USER_BASE_URL = 'https://api.example.com/user/'
```

这里的 `api.example.com` 仅为占位示例，不是可用的演示服务。保留结尾的 `/`，请求封装会直接拼接 `getBaseInfo/`、`wxLogin/` 等接口路径。项目没有 `.env` 读取或自动环境切换机制。

在小程序后台配置实际使用的请求、上传和下载域名；正式环境使用 HTTPS。仓库私有配置中的 `urlCheck: false` 仅用于本地调试，不代表发布后可以跳过域名要求。局域网联调时，还需确保测试手机能访问后端所在网络。详见[微信小程序网络说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。

### 5. 配置外部能力

| 能力 | 接入要点 |
| --- | --- |
| 微信登录 | 后端实现 `wxLogin/`，处理 `wx.login` 返回的 `code` 并签发业务 Token；后端使用的小程序配置应与前端 AppID 一致 |
| 支付与充值 | 后端提供订单、充值、余额计算和支付参数接口；前端使用 `wx.requestPayment` 并调用结果确认接口 |
| 农场监控 | 为自己的小程序接入 `ezplayer` 插件，配置摄像头与播放接口；`app.json` 中声明的 provider 为 `wxf2b3a0262975d8c2`，版本为 `latest` |
| 订阅消息 | 后端按业务场景提供模板 ID、记录用户授权并发送通知 |
| 图片与视频 | 接口返回客户端可访问的资源地址；头像、评价及售后凭证分别使用对应上传接口 |
| 农场与品牌内容 | 通过 `getBaseInfo/` 提供农场资料、首页内容和认养协议等配置；替换页面中的默认资料及图片 |

监控插件同时用于认养页和独立播放页，插件接入方式见[微信小程序使用插件说明](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html)。`app.ts` 虽然捕获了插件初始化异常，仍需正确处理插件声明和使用权限，不能据此假定未配置插件也能完成编译。

### 6. 编译与联调

在微信开发者工具中点击「编译」，默认进入首页。先检查 Console 和 Network 中的报错，再用真机预览验证微信登录、支付、图片上传、监控播放、订阅消息及海报保存等能力。

建议按以下顺序验证接入结果：

1. 首页、分类和商品详情能够获取业务数据。
2. 登录后能够读取个人资料、保存收货地址并查看个人资产。
3. 商城结算能够正确展示优惠、余额和应付金额，并从后端同步订单状态。
4. 认养订单能够生成档案，展示周期、赠品发货记录和具备权限的摄像头。
5. 活动留言、预约记录、售后及上传操作能够在后端查询到对应结果。

## 接口接入

### 请求与登录约定

接口封装集中在 [miniprogram/utils/api.ts](gegeda-wx/miniprogram/utils/api.ts)。前端使用 `GET`／`POST` 请求，上传使用 `wx.uploadFile`；接口名保留尾部 `/`。

- **响应处理**：请求层接收 HTTP `2xx` 响应，业务层通常以响应体中的 `code === 200` 判断成功，以 `msg` 展示提示。
- **登录流程**：`wx.login` → `wxLogin/` → 缓存顶层 `token` → 后续需要鉴权的请求携带 `Authorization: Bearer <token>`。
- **本地登录信息**：Token 与用户资料分别保存在 `miniToken`、`miniProfile` 中。
- **登录重试**：`requestWithAuthRetry` 针对部分业务层登录失效响应进行清理和重试；HTTP 非 `2xx` 会直接拒绝请求，两者处理路径不同。
- **数据结构**：部分页面兼容 `data`／`data.data` 及驼峰／下划线字段，但各接口并非完全统一，需结合函数参数、类型定义与调用页面确认。

普通业务响应示意：

```json
{
  "code": 200,
  "msg": "ok",
  "data": {}
}
```

登录响应示意：

```json
{
  "code": 200,
  "msg": "ok",
  "token": "<由后端签发的业务 Token>",
  "data": {
    "nickname": "示例用户",
    "avatar": ""
  }
}
```

以上仅说明响应外层约定，不能替代各业务接口的字段定义。列表接口根据页面需要返回数组或带 `list`、`hasMore` 等字段的对象。

### 主要接口分组

下表列出代表性接口，完整参数、请求方法和类型以 `api.ts` 为准。

| 分组 | 代表接口 |
| --- | --- |
| 登录与资料 | `wxLogin/`、`getUserProfile/`、`updateUserProfile/`、`uploadAvatar/` |
| 首页与基础配置 | `getBaseInfo/`、`getHomeBanners/`、`getHomeNotices/` |
| 商品与收藏 | `getMallCategories/`、`getMallProducts/`、`getMallProductDetail/`、`toggleProductFavorite/`、`getFavoriteProducts/` |
| 购物车 | `getCartList/`、`addCartItem/`、`updateCartItem/`、`deleteCartItem/` |
| 订单与支付 | `createMallOrder/`、`getMallOrderList/`、`getMallOrderDetail/`、`repayMallOrder/`、`confirmMallOrderPaid/`、`cancelMallOrder/`、`confirmMallOrderReceived/` |
| 评价与售后 | `getMallProductReviews/`、`createMallOrderReview/`、`createMallAfterSale/`、`submitMallAfterSaleReturn/`、`uploadMallReviewImage/`、`uploadMallAfterSaleEvidence/` |
| 认养 | `getAdoptCategories/`、`getAdoptProducts/`、`getAdoptProductDetail/`、`getAdoptAvatarOptions/`、`createAdoptOrder/`、`confirmAdoptOrderPaid/`、`cancelAdoptOrder/` |
| 认养档案与互动 | `getMyAdoptArchive/`、`getAdoptGiftShipments/`、`createAdoptChatMessage/`、`getAdoptOrderMonitorPlayInfo/` |
| 监控 | `getMonitorAreas/`、`getMonitorCameras/`、`getMonitorPlayInfo/` |
| 活动与预约 | `getHomeActivities/`、`getHomeActivityDetail/`、`getActivityMessages/`、`createActivityMessage/`、`createReservation/`、`getReservationRecords/` |
| 地址 | `getAddressList/`、`createAddress/`、`updateAddress/`、`deleteAddress/` |
| 资产与优惠券 | `getBalanceStats/`、`getBalancePackageList/`、`createBalanceRechargeOrder/`、`getPointRecordList/`、`getCouponCenterList/`、`claimCoupon/`、`getMyCouponList/` |
| 订阅消息 | `getSubscribeMessageTemplates/`、`saveSubscribeMessageAuth/` |

### 接入时需要区分的状态

- **界面金额与实际支付**：页面会展示优惠、余额抵扣和微信支付金额，最终金额及支付结果应由后端核定；客户端成功回调不能替代服务端支付校验。
- **本地缓存与服务端记录**：购物车读取、更新和删除在部分失败场景下会回退到本地数据；本地交互成功不代表服务端已同步，后续读取仍可能被服务端数据覆盖。
- **默认档案与真实认养**：没有登录、没有认养数据或读取失败时，认养页会展示默认档案；真实聊天和关联监控需要有效认养记录。

## 常见问题

**页面能打开，但商品或活动列表为空。** 先检查 `USER_BASE_URL` 是否仍为仓库内的局域网地址，再检查网络可达性、域名配置和接口响应结构。源码不附带商品、活动或摄像头初始化数据。

**找不到开发或构建命令。** 本项目使用微信开发者工具编译 TypeScript，当前 `package.json` 没有开发服务器、构建或测试脚本。

**登录失败或反复提示登录失效。** 检查前后端 AppID 是否一致、`wxLogin/` 是否返回顶层 `token`、受保护请求是否携带 Bearer Token。切换后端环境后可清理本地登录缓存再试。

**监控页面为空或提示插件不可用。** 检查插件使用权限、区域和摄像头配置、后端返回的 `accessToken` 与 `playUrl`，并使用真机验证。认养页监控还需要档案绑定摄像头且允许查看。

**订单已创建，但没有调起微信支付。** 先核对后端订单状态、余额抵扣结果以及支付参数。余额覆盖应付金额时可能无需微信补差支付；不能仅以是否弹出收银台判断订单成功。

**本地调整的基础库或调试选项没有按预期生效。** 检查 `project.private.config.json`，其中的同名字段可以覆盖 `project.config.json`。

## 参与贡献

欢迎通过 Issue 反馈问题、讨论功能或补充接入文档，也欢迎提交 Pull Request。

1. 涉及代码修改的贡献，请先联系作者确认授权，再 Fork 仓库并创建独立的功能或修复分支。
2. 保持原生小程序和 TypeScript 的现有组织方式；新增页面同步更新 `app.json`，新增接口优先放入 `utils/api.ts`。
3. 使用微信开发者工具编译并验证受影响流程；涉及支付、插件、上传或授权时补充真机验证情况。
4. 提交 Pull Request，说明变更目的、影响页面、接口依赖和验证结果；界面调整可附截图。

提交问题时，请提供开发者工具及基础库版本、运行设备、复现步骤、预期结果和实际结果。日志及截图中的 Token、联系方式、地址等个人信息请先脱敏；请勿提交 AppSecret、商户密钥或真实支付凭据。

当前仓库未提供自动化测试脚本或 CI 配置。功能变更应附上实际验证记录，文档变更请检查相对链接、截图路径与代码描述是否一致。

## 授权说明

**使用本项目代码前，须先联系作者并获得明确授权。** 个人使用、二次开发、部署、商业使用及分发均需事先取得相应授权，具体使用范围和条件以作者授权内容为准。

本项目未采用允许自由使用的通用开源许可证。仓库公开展示源码不代表自动授予使用、修改或分发权限。

## 获取全套代码与帮助

如需获取全套 **后端服务 + Web 管理端 + 微信小程序** 代码，或咨询使用授权、项目接入及使用问题，请通过以下方式联系作者：

| 联系方式 | 账号 |
| --- | --- |
| 微信 | `AirCasual` |
| QQ | `1401574454` |

联系时请注明「认养一只鸡项目」，并简要说明使用场景或需要的帮助，便于沟通授权及代码获取事宜。
