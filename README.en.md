# gegeda-wx · Adopt a Chicken

A native **WeChat Mini Program built with TypeScript** for farm adoption, agricultural product sales and farm visits. The client includes a storefront, adoption records, orders and after-sales requests, live farm cameras, events, reservations and personal account features.

[简体中文](README.md) · [Screenshots](README.md#界面预览) · [Getting started](#getting-started) · [Backend integration](#backend-integration) · [Authorization](#authorization) · [Full source code and help](#full-source-code-and-help)

> This repository contains the Mini Program frontend. Backend services, an administration application, a database and seed data are not included. **Contact the author and obtain explicit authorization before use.** See [Authorization](#authorization). For the complete backend, Web administration application and Mini Program source code, [contact the author via WeChat or QQ](#full-source-code-and-help).

## Screenshots

The [Chinese README gallery](README.md#界面预览) uses the original screenshots in [images](images/), covering the home page, storefront, adoption records, product details, account, reservations and camera center. Screenshots reflect the data and page states at capture time; some show empty or not-yet-adopted states.

## Features

The following describes implemented frontend interactions and API calls. Business operations depend on the connected backend and external services.

| Area | Features |
| --- | --- |
| Home | Banners, announcements, product search, promotional products and countdowns, adoption recommendations, featured products, farm video and service navigation |
| Storefront | Categories and product tags, search, product details, SKU and quantity selection, delivery options, favorites, reviews and coupons |
| Cart | Item selection, quantity changes, swipe-to-delete, totals and multi-item checkout; some operations fall back to local storage |
| Orders | Addresses, coupons, balance-first payment with WeChat payment for the remainder, invoice details, status filters, payment retry, cancellation, shipment information and receipt confirmation |
| Reviews and after-sales | Ratings, text and image reviews, refund-only or return-and-refund requests, evidence uploads, request status and return shipment details |
| Adoption | Plans and agreements, adoption name and avatar, delivery information, notes, coupons, invoice details, order submission and payment |
| Adoption records | Multiple records, leg-band information, status and progress, gift shipments, linked cameras, chat interactions, poster generation and saving |
| Farm cameras | Area selection, camera lists, live playback, loading states and retry through the `ezplayer` plugin |
| Events and visits | Event details and comments; visit date, time, party size, purpose and contacts; reservation records and approval status |
| Account and assets | Login, profile editing, addresses, favorites, customer service, farm contacts and map navigation, balance recharge and records, points, adoption records and coupons |
| Sharing and notifications | Sharing for supported pages; subscription-message authorization for order, after-sales, adoption and reservation events |

### Implementation scope

- There is no complete offline demo mode. Most business data comes from HTTP APIs.
- Payment verification, balance accounting, refunds, shipment processing and reservation approval require backend implementations.
- Adoption chat calls `createAdoptChatMessage/` and stores conversation history locally. A reply-generation service is not included.
- Camera playback requires plugin access, configured devices and valid playback information. Subscription messages require backend templates and message delivery.
- `pages/coop/coop` is a registered cooperation-interest form with validation and a local submission flag. It does not submit an application to a server, despite showing a success message.
- Active event routes are `pages/event/event` and `pages/event-detail/event-detail`. The two page implementations under `pages/activity/` are not registered in `app.json`.
- Invoice fields are submitted with orders; an invoice-issuing service is not included.

## Technology and structure

The project uses native `App`/`Page` APIs, WXML, WXSS and TypeScript. Requests and uploads use `wx.request` and `wx.uploadFile`. Local storage holds authentication, cart cache, checkout drafts and selected interaction records. Camera playback uses the EZVIZ `ezplayer` plugin; adoption posters use WeChat Canvas.

Global configuration includes `style: v2`, the `glass-easel` component framework and on-demand component loading. TypeScript compilation is handled by the WeChat DevTools compiler plugin. Local type declarations are in `typings/`, and `package.json` declares `miniprogram-api-typings` as a development dependency.

| Path | Purpose |
| --- | --- |
| `images/` | Screenshots for documentation |
| `miniprogram/app.ts` | Application and player initialization |
| `miniprogram/app.json` | Routes, tabs, window and plugin configuration |
| `miniprogram/app.wxss` | Global styles |
| `miniprogram/pages/` | Page files: `ts` / `json` / `wxml` / `wxss` |
| `miniprogram/images/` | Runtime images and icons |
| `miniprogram/utils/api.ts` | Base URL, authentication and business APIs |
| `miniprogram/utils/util.ts` | Shared utilities |
| `typings/`, `tsconfig.json` | TypeScript declarations and configuration |
| `project.config.json` | Shared DevTools configuration |
| `project.private.config.json` | Local settings that can override shared configuration |

[app.json](adapt/gegeda-wx/miniprogram/app.json) registers 26 pages. Home, storefront, adoption, cart and account are the five bottom tabs. A complete [page index](README.md#页面索引) is available in the Chinese README.

## Getting started

These steps are intended for users who have obtained authorization from the author. A complete experience requires a compatible backend and your own Mini Program, payment and camera service configuration.

### 1. Prepare the environment and source

Install [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html), prepare your own Mini Program AppID and developer access, and provide a reachable compatible backend. Node.js and npm are used to install the development dependency.

```bash
git clone https://gitee.com/lytcreate/gegeda-wx.git
cd gegeda-wx
npm install
```

There are currently no npm runtime dependencies or `dev`, `build` or `test` scripts. Compile the Mini Program through WeChat DevTools.

The shared configuration sets `libVersion` to `trial`; the private configuration sets it to `3.15.1`. These are recorded development settings, not a verified minimum supported version. Choose the base library according to your DevTools, devices and plugin requirements.

### 2. Import the project

1. In WeChat DevTools, select **Import Project**.
2. Select the repository root containing `project.config.json`.
3. Use your own AppID and keep the `appid` field in `project.config.json` consistent with it.
4. Confirm the project type is Mini Program, the source root is `miniprogram/` and the TypeScript compiler plugin is enabled.

The committed AppID belongs to the original project configuration. Use your own configuration when connecting your backend and platform services. See the official [project configuration reference](https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html).

### 3. Configure the backend

Edit `USER_BASE_URL` at the top of [miniprogram/utils/api.ts](adapt/gegeda-wx/miniprogram/utils/api.ts). Its current value, `http://192.168.3.37:8000/user/`, is a local-network development address. Replace it with your own service, for example:

```ts
export const USER_BASE_URL = 'https://api.example.com/user/'
```

`api.example.com` is a placeholder, not a demo backend. Keep the trailing slash: the wrapper directly appends paths such as `getBaseInfo/` and `wxLogin/`. There is no `.env` loader or automatic environment switching.

Configure the request, upload and download domains used by your Mini Program and use HTTPS in production. The committed `urlCheck: false` setting is for local debugging and does not bypass production domain requirements. For local-network testing, the phone must also be able to reach the backend. See the official [network guide](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html).

### 4. Connect external services

| Service | Required integration |
| --- | --- |
| Login | Implement `wxLogin/` to exchange the `wx.login` code and return a business token using the same Mini Program configuration |
| Payments and recharge | Implement order creation, balance calculations, payment parameters and server-side payment verification |
| Cameras | Enable `ezplayer` for your Mini Program and provide device/playback APIs; the committed provider is `wxf2b3a0262975d8c2` and the version is `latest` |
| Subscription messages | Return template IDs by business scene, record authorization and send messages from the backend |
| Media | Return accessible image/video URLs and implement avatar, review and after-sales evidence uploads |
| Farm content | Supply farm information, homepage content and the adoption agreement through `getBaseInfo/`; replace default information and assets |

The camera plugin is used in both the adoption page and the dedicated player page. Follow the official [plugin integration guide](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html). Catching initialization errors in `app.ts` does not remove plugin declaration or access requirements during compilation.

### 5. Compile and validate

Select **Compile** in WeChat DevTools. Inspect Console and Network errors, then test login, payment, uploads, camera playback, subscription authorization and poster saving on a real device.

Validate product loading first, followed by login and addresses, checkout and order status, adoption records, reservations and after-sales flows. Confirm server-side records as well as page feedback.

## Backend integration

All request functions and business types are defined in [api.ts](adapt/gegeda-wx/miniprogram/utils/api.ts). API paths use trailing slashes, regular requests use `GET` or `POST`, and files use `wx.uploadFile`.

- The request layer accepts HTTP `2xx`; business logic generally checks `code === 200` and uses `msg` for feedback.
- Login expects a top-level `token`. Protected requests use `Authorization: Bearer <token>`.
- The storage keys are `miniToken` and `miniProfile`.
- `requestWithAuthRetry` handles selected authentication failures in response bodies. Non-`2xx` HTTP responses reject directly and follow a different path.
- Some pages accept `data` or `data.data` and camelCase or snake_case fields. These rules are not uniform; inspect the calling page as well as the API wrapper.

Login-response example:

```json
{
  "code": 200,
  "msg": "ok",
  "token": "<backend-issued business token>",
  "data": {
    "nickname": "Example user",
    "avatar": ""
  }
}
```

Other business responses generally use `code`, `msg` and `data`. List endpoints may return arrays or objects containing fields such as `list` and `hasMore`. The [API group index](README.md#主要接口分组) lists representative endpoints; exact methods, parameters and fields are defined by `api.ts` and its callers.

### State and data boundaries

- Displayed amounts and client payment callbacks do not replace backend pricing and payment verification.
- Cart reads, updates and deletions may fall back to local data after an API failure. This does not guarantee server synchronization, and later reads may replace the local state.
- The adoption page displays a default record when logged out, when no records exist or when loading fails. Chat and linked cameras require a valid adoption record.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Empty product or event lists | Base URL, network access, allowed domains, response structure and backend data |
| No development/build command | Compile through WeChat DevTools; no npm scripts are defined |
| Login keeps failing | Matching AppIDs, top-level login token, Bearer header and stale authentication after switching backends |
| Missing cameras or unavailable player | Plugin access, devices, `accessToken`, `playUrl` and real-device behavior; adoption playback also needs an allowed camera association |
| No WeChat payment dialog | Backend order status, balance coverage and payment parameters; a fully balance-funded order may not need a WeChat payment |
| Unexpected local settings | Overrides in `project.private.config.json` |

## Contributing

Issues and pull requests are welcome for bug reports, feature discussions and documentation improvements.

1. For code contributions, contact the author to confirm authorization before forking the repository and creating a focused feature or fix branch.
2. Follow the native Mini Program and TypeScript structure. Register new pages in `app.json` and keep API wrappers in `utils/api.ts` where practical.
3. Compile and validate affected flows. Include real-device results for payment, plugins, uploads or authorization changes.
4. Explain the purpose, affected pages, backend dependencies and validation results in your pull request. Include screenshots for UI changes when useful.

Bug reports should include DevTools and base-library versions, device information, reproduction steps, expected behavior and actual results. Remove tokens and personal information from logs and screenshots. Do not commit AppSecrets, merchant keys or real payment credentials.

The repository currently has no automated test scripts or CI configuration. Record actual validation for code changes and check relative links, screenshot paths and code accuracy for documentation changes.

## Authorization

**Contact the author and obtain explicit authorization before using this project's code.** Personal use, modification, deployment, commercial use and redistribution each require prior authorization covering the intended activity. The scope and conditions of use are governed by the authorization provided by the author.

This project is not offered under a standard open-source license permitting free use. Public availability of the source code does not automatically grant permission to use, modify or redistribute it.

## Full source code and help

To obtain the complete **backend services + Web administration application + WeChat Mini Program** source code, or to discuss authorization, integration or usage questions, contact the author:

| Contact method | Account |
| --- | --- |
| WeChat | `AirCasual` |
| QQ | `1401574454` |

Please mention the “Adopt a Chicken / 认养一只鸡” project and briefly describe your intended use or the help you need.
