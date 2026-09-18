# Agent Note: 桌面发布身份与衍生发行版归属

Status: implemented

[English](2026-09-18-desktop-brand-identity-and-attribution.md) | 中文

## Problem

桌面发布只打包一个产品：`productName: 'DeepSeek Harness'`、`artifactName: 'deepseek-harness-${version}-${os}-${arch}.${ext}'`，以及上游鲸鱼图标，全部字面写在 `apps/desktop/scripts/electron-builder-config.mjs` 里。随星发行版要用自己的名称、文件名和图标发布同一套外壳，并且作为衍生发行版，必须在用户能找到的地方说明其 DeepSeek Harness 来源、MIT 许可证和第三方归属。把第二个品牌硬编码进打包配置会分叉发布流水线；放着图标不动则是在别人的产品名下发出上游图标；而原生关于面板的名称来自字面量，重新命名后的构建仍会自称 DeepSeek Harness。同时，上游发布必须完全不变。

## Decision

`apps/desktop/scripts/desktop-product-identity.mjs` 是打包身份的唯一来源：`productName`、`artifactSlug`、`artifactName`、三个图标路径，以及衍生发行版所欠的归属信息。优先级为 `DSH_DESKTOP_PRODUCT_NAME`，其次 `DSH_CLIENT_BUILD_PROFILE === 'suixing'`，最后是上游默认值；`DSH_DESKTOP_ARTIFACT_SLUG` 覆盖由产品名推导的前缀，`DSH_DESKTOP_ICON_DIRECTORY`（相对路径以 `apps/desktop` 为基准）必须包含 `icon-macos.png` 与 `icon-windows.png`。

两条一致性规则让“半品牌化”的发布无法成立，而不只是不被鼓励。产品名不是 `DeepSeek Harness` 却没有 `DSH_DESKTOP_ICON_DIRECTORY` 会被拒绝，因此上游图标永远不会以别的名称发出；归属来源也必须可解析，因此衍生发布无法在缺少许可证与声明文件的情况下构建。“衍生”的定义恰好是“产品名不同于上游”，这正是两者必须同时出现、不可分开的原因。

身份随后流经三个面。`extraMetadata` 增加 `dshDesktopProductName` 与 `dshDesktopAttribution`，`extraResources` 在运行时旁边增加仓库的 `LICENSE` 与 `THIRD_PARTY_NOTICES.md`，`src/main.ts` 在设置原生关于面板时读取这些清单字段——`app.setAboutPanelOptions` 现在在读取打包清单之后执行，而缺失、空串、纯空白或非字符串的字段会回退到上游名称与空的归属行。上游身份贡献一个空的元数据对象和一个空的资源列表，因此它的清单、资源列表和关于面板保持本次变更之前的原始字节。

安装包文件名前缀由同一解析器在 `apps/desktop/scripts/desktop-upload-plan.ts` 与 `apps/desktop/scripts/package-macos.ts` 中重建，后者还包括 `.app` 包目录。已安装更新资格验证工具链则刻意固定上游产品名与前缀，因为该工具链校验的是它自己的分发步骤产出的固定文件名。

发布配置属于目标 dotenv 文件，因此这三个新变量加入 `apps/desktop/scripts/desktop-package-environment.mjs` 的共享配置白名单与环境变量清理规则，且 `validateDesktopPackageEnvironment` 会在签名或下载之前解析身份。

## Alternatives considered

**在打包配置里硬编码第二个品牌。** 写起来最省事，维护起来最糟：之后每个发行版都要改发布流水线，两套字面量还会悄悄漂移。故障会以 `.app` 名称不匹配或上传计划找不到产物这种形式出现。

**只做产物文件名前缀的品牌化。** 前缀只是文件名开头。关于面板、`.app` 目录、安装器注册的产品名和图标仍会写着 DeepSeek Harness。

**通过 `app.getName()` 读取关于面板名称。** Electron 会从打包清单解析它，因此品牌化构建大概率能工作。但仓库中没有任何地方固定“electron-builder 会把 `productName` 写到 Electron 读取的位置”这一点，面板就会依赖一个隐式的打包行为，而不是发布自己记录的字段——后者恰恰是测试能断言的东西。

**对上游也一律写入归属说明。** 上游本身就是这项工作的来源；让它归属于自己只会改变已发布的关于面板和清单，没有任何法律收益，还会破坏“默认发布不变”的要求。

**用 `settings.section` 注册一个客户端关于页。** 那会新增第二个关于面，需要自己的字典、样式和测试，而原生面板已经占据了用户会打开的菜单位置。完整的第三方声明远超面板能承载的长度，这也是它以文件形式随包分发的原因。

**在打包时从 dotenv 文件决定归属。** dotenv 文件同时承载凭据与环境配置；只存在于那里的品牌决策无法在仓库中被评审，而从另一个检出重新打包的发布会悄悄丢失它。

## Consequences

`apps/desktop/scripts/desktop-product-identity.mjs` 及其声明文件是身份的归属地；`electron-builder.config.d.mts` 把 `extraResources` 从固定的二元组放宽为列表，其 `extraMetadata` 增加两个可选的归属字段。`apps/desktop/electron-builder.config.mjs` 自身不做任何计算——它只展开解析器的返回值。

品牌化桌面构建现在需要品牌化桌面图标。仓库只有 108px 的客户端 logo，而品牌规范禁止放大，因此桌面图标集仍由产品方提供，缺失时会显式构建失败。这是有意留下的空缺，而不是已完成的品牌：`DSH_DESKTOP_ICON_DIRECTORY` 就是图标进入的位置。

关于面板现在在读取清单期间设置，而不是在构建菜单之前。面板只在用户打开时才被读取，因此这次调用后移不可观测，启动测试套件同时断言了上游清单与品牌化清单的结果。

桌面发布文档、两个 `.env.*.example` 模板以及桌面身份测试套件（`apps/desktop/tests/desktop-product-identity.spec.ts`）覆盖了优先级、拒绝规则、产物文件名前缀和“默认字节不变”的声明。`apps/desktop/tests/main-startup.spec.ts` 覆盖面板本身，其测试装置现在也会暴露发布所记录的清单字段。
