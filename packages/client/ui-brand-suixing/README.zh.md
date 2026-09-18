---
description: "SuiXing 在通用侧栏中的占位实现：产品标志与名称，以及两个业务菜单及其各自的目录页。"
kind: "package-reference"
---

# SuiXing 浏览器品牌与目录

[English](README.md) | 中文

## 概述

本包让以 `suixing` profile 构建的客户端在通用侧栏中拥有自己的门面：SuiXing 标志与名称，以及产品的两个业务菜单——AI 参谋部（辅助名称 Agent 中心）与自动化工厂（辅助名称 WorkFlow 中心）——各自打开自己声明的能力目录。官方版与本地版构建保留外壳的兜底呈现。菜单是数据：本包把目录分组与能力定义发布到 `ctx.sidebarCatalog`，并为每个菜单注册一个主面板；外壳只渲染发行方发布的内容。除侧栏自身的折叠与最近使用记忆外，本包不保留状态，也不影响模型请求。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)
- [延伸阅读](#further-exploration)

-----

<a id="use-this-package"></a>
## 使用本包

`suixing` 构建通过组合本包来填充侧栏的通用席位并发布其业务菜单；其他构建不包含它。品牌席位是 `sidebar.brand.mark` 与 `sidebar.brand.name`，菜单则通过 `ctx.sidebarCatalog` 发布。本包读取 `DSH_CLIENT_BUILD_PROFILE`：`suixing` 下注册，其他 profile 下 `apply()` 在触碰任何 slot 之前就返回，外壳因此保留自己的兜底呈现。品牌标记渲染自 `assets/logo.png`，它是 `assets/logo.svg` 母版的 256 像素导出。

<a id="model-experience"></a>
## 模型体验

无，因为这个纯展示包不会增加模型可见文字、工具或 Token。

#### KV Cache 影响

无；这个包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制定义了 SuiXing 品牌与菜单的供给方式。它们是当前包的约束，既不是品牌设计对比，也不是任务清单。

- **图稿来自矢量重建** —— `assets/logo.svg` 把 108 像素的产品位图重建为弧段与渐变，`assets/logo.png` 是它的 256 像素导出，供内嵌使用。产品方发布正式矢量图时请替换该母版。
- **构建 profile 是唯一的开关** —— 不存在运行时品牌配置，换品牌意味着接入另一个占用相同 slot 的包。
- **菜单承载的是页面定义，不是可用页面** —— 每个能力行都打开所属菜单的目录页，展示已批准的页面定义：主引导、用途说明、三个快速任务与资料提示。能力自身的页面随后续平台闭环任务接入；改指向只需修改 `directory/specs.ts` 中的一处 `target`。
- **原型三类入口中的两类** —— 内容创作工具与项目列表尚未发布；它们将作为更多分组接入，侧栏外壳无需改动。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [ui-sidebar](../ui-sidebar/README.zh.md) —— 渲染这些席位与目录区域的外壳，本包向其发布内容。
- [ui-layout](../ui-layout/README.zh.md) —— 目录面板注册的 `main` keyed slot 的持有者。
- [locale](../locale/README.zh.md) —— 两个命名空间背后的字典注册表。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

`src/client/directory/specs.ts` 中的能力元数据是菜单的唯一来源：分组 id、菜单顺序、面板键，以及每个能力的定义行；locale 键由能力 id 计算得出。`src/client/directory/DirectoryPage.tsx` 是一个服务两个菜单的模板，分组通过注册的 `inject` 载荷送达。新增一个菜单等于在 `DIRECTORY_GROUPS` 中加一项并补字典键；新增一个能力等于在 `AGENT_IDS` 或 `WORKFLOW_IDS` 中加一个 id 并补它的定义行。

</details>

**运行时不变式：** 不发布伴生入口。品牌占位与目录注册都通过 `ctx.effect()` 安装与释放；除了侧栏自身的折叠与最近使用切片外，本包不保留任何状态。
