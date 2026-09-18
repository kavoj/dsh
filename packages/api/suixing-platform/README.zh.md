---
description: "SuiXing 对接 agent.35sz.top 的桥接契约：统一响应信封、错误码，以及一个可在真实 HTTP 传输与 fixture 模拟传输上无差别运行的客户端。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-suixing-platform

[English](README.md) | 中文

## 概述

SuiXing 发行版与 `agent.35sz.top`（随星问）之间的契约。它读取平台统一的响应信封 `{code, message, data, timestamp, path}`，归类 SX-002 探针实观测到的错误码，并提供一个客户端——在真实 HTTP 传输与「用已脱敏录制报文作答的 mock」上运行结果完全一致。一个失败会带上它的平台码、类别、请求路径与 HTTP 状态，调用方无需读堆栈即可定位问题出在哪。

## 目录

- [使用本包](#use-this-package)
- [响应信封](#the-envelope)
- [一个客户端，两种传输](#one-client-two-transports)
- [Model Experience](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```ts
import {
  createHttpTransport,
  createSuixingPlatformClient,
  isPlatformError,
} from '@deepseek-ai/dsh-api-suixing-platform'

const client = createSuixingPlatformClient(createHttpTransport({ baseUrl: 'https://agent.35sz.top' }))
const { token } = await client.login({ username: 'demo-admin', password: '…' })
const team = await client.getCanmouTeam(token)
```

带类型的方法覆盖探针已确认形状的端点（`login`、`listModels`、`getCanmouTeam`、`listWorkflows`、`getStorageUsage`、`getChatConfig`）。探针共枚举出 128 条路径；其余路径可经 `client.send({ method, path, token, query, body })` 触达，直到每条都配上类型包装与录制 fixture 为止。

本包不持有 UI、不做持久化、不存凭据。调用方在每次鉴权请求上自行传入 token，并决定它存放在哪（SX-010 规则：长期凭据属于操作系统安全存储，绝不进入浏览器存储、URL 或日志）。

<a id="the-envelope"></a>
## 响应信封

每个响应都是 `{code, message, data, timestamp, path}`。`20000` 为成功；其余一律视为失败并以 `SuixingPlatformError` 抛出，绝不作为 `undefined` 返回。平台的 `BusinessCode` 表按万位分段，因此桥接按段归类而非逐码硬编码：`40xxx` 通用客户端错误、`401xx` 参数错误、`402xx` 未认证、`403xx` 无权限、`404xx` 数据不存在、`406xx` 业务规则不通过、`407xx` 限流、`5xxxx` 服务端错误。未映射的码降级为 `unknown` 并保留原始码，而不是再抛一个更没用的错误。

不是信封的负载本身就是失败：平台对未知路径返回其 SPA，所以该出现 JSON 的地方来了 HTML，说明路由错了——`code: 0` 把这个事实点出来，而不是把它藏起来。

<a id="one-client-two-transports"></a>
## 一个客户端，两种传输

两种传输都把原始负载交给同一个 `readEnvelope`，因此「什么算成功」不可能在真实平台与模拟平台之间发生漂移。`createHttpTransport` 只额外做 mock 不需要的三件事：拼 URL、加 Bearer 头、解析 JSON。`createMockTransport` 从 `PLATFORM_FIXTURES` 作答，并对未录制的路径复刻平台的 404 信封。

Fixture 保存探针捕获的字段集合，且每个值都是合成的——仓库中不存任何真实 token、账号、邮箱或上传地址。所有实体类型都带索引签名，因此平台新增的字段会原样穿过，而不会被丢弃或拒绝。

<a id="model-experience"></a>
## 模型体验

无。本桥接只发起平台请求，不注册任何面向模型的能力。

#### KV Cache 影响

无直接影响；它既不拼装提示词，也不承载模型输入。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 上面列出的端点才有类型；其余 249 条 `/api` 路由可经 `send` 触达，但尚未建模。
- 流式端点（`/api/ai-agents/:id/chat/stream`）未包装。SX-006 已从源码确认它说的是 Vercel AI SDK 的 UI Message Stream（`pipeUIMessageStreamToResponse`），而非自研事件集，并且 `responseMode: "blocking"` 会改为返回一次信封 JSON；其解析器与中断路径推迟到 SX-007，这里不用 fixture 冒充二者中的任何一个。
- 限流未建模。探针在鉴权请求上未观测到 `X-RateLimit-*` 或 `Retry-After` 头，因此在实测前重试/退避策略未定（SX-010）。
- 卡密兑换已接入，但设备绑定没有。已确认 `POST /api/card-key/redeem` 是唯一的前台激活路由，它发放积分或会员；平台不带设备指纹，因此在产品侧决定是否需要之前，一张卡可激活多台机器。
- Fixture 由探针输出人工脱敏、并与平台源码核对而来；它们钉住字段集合，而非字节级平台响应。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`src/types.ts` 仅含类型，因此不在覆盖率要求内（仓库豁免 `packages/*/*/src/types.ts`）。`src/index.ts` 是纯转发 barrel，没有 V8 可归属的可执行段，因此与等价的 `packages/api/remotes/src/index.ts` 条目并列在覆盖率排除清单中。

</details>

**运行时不变式：** 不发布任何伴随包。token 生命周期由调用方拥有，`SuixingPlatformError` 的处理方式同样由调用方决定。
