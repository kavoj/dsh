/**
 * The channel catalog data: every promotion platform this workspace tracks,
 * its role category, and the authorization tier that decides how a self-built
 * marketing system can reach it. Static by design — the page reads no Remote,
 * and changing the catalog is a source change, reviewed like any other.
 *
 * Source: 营销推广平台全景梳理（2026-09-25）· 76 platforms / 8 categories.
 * Every status starts at 「none」: no driver exists yet, and a card must never
 * claim an integration the installation cannot perform.
 */

export type TierId = 'official' | 'cps' | 'enterprise' | 'audit' | 'automation'
export type StatusId = 'none' | 'dev' | 'live' | 'review'

/** One authorization tier: how a platform is reached, in the sidebar filter and on a card. */
export interface Tier { readonly id: TierId; readonly label: string; readonly short: string }

/** One role category: what the platforms in it contribute to the funnel. */
export interface ChannelCategory { readonly id: string; readonly name: string; readonly role: string }

/** One promotion platform. */
export interface ChannelPlatform {
  readonly id: string
  readonly name: string
  readonly cat: string
  readonly tier: TierId
  readonly status: StatusId
  readonly desc: string
  readonly scenes: readonly string[]
}

export const TIERS: readonly Tier[] = [
  { id: 'official', label: '官方 API｜个人可申请，可直接对接', short: '官方直连' },
  { id: 'cps', label: 'CPS 联盟｜个人可注册，转链 + 订单归因', short: '个人可注册' },
  { id: 'enterprise', label: '需企业｜须企业/个体户资质或店铺主体', short: '需企业主体' },
  { id: 'audit', label: '需审核｜App Review / 商务审批，数周', short: '需平台审核' },
  { id: 'automation', label: '仅自动化｜无个人可用接口，需浏览器自动化', short: '仅自动化' },
]

export const CATEGORIES: readonly ChannelCategory[] = [
  { id: 'A', name: '内容种草与社区', role: '建立信任、搜索长尾' },
  { id: 'B', name: '短视频与直播', role: '规模化曝光、直播成交' },
  { id: 'C', name: '社交媒体与私域', role: '品牌人格、复购、私域承接' },
  { id: 'D', name: '货架电商', role: '承接搜索需求、成交主阵地' },
  { id: 'E', name: '联盟分销 CPS', role: '个人唯一低门槛变现路线' },
  { id: 'F', name: '二手与本地生活', role: '低成本起量、本地到店' },
  { id: 'G', name: '广告投放', role: '付费放量、门槛最高' },
  { id: 'H', name: '开发者与新品渠道', role: '0 成本冷启动、拿背书' },
]

export const PLATFORMS: readonly ChannelPlatform[] = [
  { id: 'baijiahao', name: '百家号', cat: 'A', tier: 'official', status: 'none', desc: '百度内容生态，搜索长尾流量稳定；官方开放发布接口，国内最易直连', scenes: ['SEO 内容', '工具站'] },
  { id: 'xiaohongshu', name: '小红书', cat: 'A', tier: 'automation', status: 'none', desc: '一二线女性、搜索+推荐双驱动；个人无发布接口，需浏览器自动化', scenes: ['DTC', '美妆家居'] },
  { id: 'weibo', name: '微博', cat: 'A', tier: 'audit', status: 'none', desc: '热点传播快、公域话题强；有发布接口但需逐接口审核', scenes: ['事件营销'] },
  { id: 'smzdm', name: '什么值得买', cat: 'A', tier: 'cps', status: 'none', desc: '购买意图最强的导购社区，可挂商品直链、按 CPS 结算', scenes: ['3C 家电'] },
  { id: 'zhihu', name: '知乎', cat: 'A', tier: 'automation', status: 'none', desc: '高信任、高客单决策社区；无公开内容发布平台', scenes: ['B 端 SaaS'] },
  { id: 'toutiao', name: '今日头条', cat: 'A', tier: 'automation', status: 'none', desc: '算法分发公域巨大，中老年与下沉占比高；无第三方发布 API', scenes: ['健康养生'] },
  { id: 'douban', name: '豆瓣', cat: 'A', tier: 'automation', status: 'none', desc: '文艺小众、精准但量小，基本无电商闭环', scenes: ['小众品牌'] },
  { id: 'tieba', name: '百度贴吧', cat: 'A', tier: 'automation', status: 'none', desc: '关键词聚集、人群精准；旧接口无发帖能力', scenes: ['垂直行业'] },
  { id: 'soul', name: 'Soul', cat: 'A', tier: 'automation', status: 'none', desc: '年轻向兴趣社交，无面向开发者的开放平台', scenes: ['年轻向 App'] },
  { id: 'douyin', name: '抖音', cat: 'B', tier: 'enterprise', status: 'none', desc: '算法推荐极强、兴趣电商闭环完整；发布能力不对个人开放', scenes: ['本地生活', 'App 拉新'] },
  { id: 'youtube', name: 'YouTube', cat: 'B', tier: 'official', status: 'none', desc: '搜索+推荐并存；Data API v3 免费，默认 100 次上传/日', scenes: ['教程评测', '出海'] },
  { id: 'tiktok', name: 'TikTok', cat: 'B', tier: 'audit', status: 'none', desc: '全球年轻用户；未过 audit 的应用只能发私密（SELF_ONLY）', scenes: ['跨境 DTC'] },
  { id: 'bilibili', name: '哔哩哔哩', cat: 'B', tier: 'enterprise', status: 'none', desc: '年轻中长视频、知识区友好；有稿件提交接口，须签开发者协议', scenes: ['数码软件'] },
  { id: 'shipinhao', name: '微信视频号', cat: 'B', tier: 'automation', status: 'none', desc: '社交推荐+公域，中老年增量大；助手开放能力无视频发布接口', scenes: ['直播电商'] },
  { id: 'kuaishou', name: '快手', cat: 'B', tier: 'enterprise', status: 'none', desc: '老铁信任经济、下沉与产业带；发快手能力需已上线小程序', scenes: ['农产产业带'] },
  { id: 'x', name: 'X (Twitter)', cat: 'C', tier: 'official', status: 'none', desc: '实时舆论场；2026-02 起按量付费，含链接帖约 $0.20/条', scenes: ['公关热点', '创始人 IP'] },
  { id: 'telegram', name: 'Telegram', cat: 'C', tier: 'official', status: 'none', desc: 'Bot API 免费、个人即可、无审核；30 msg/s', scenes: ['私域沉淀'] },
  { id: 'discord', name: 'Discord', cat: 'C', tier: 'official', status: 'none', desc: 'Bot API 免费；>100 服务器需验证', scenes: ['开发者社区'] },
  { id: 'wechat-mp', name: '微信公众号', cat: 'C', tier: 'enterprise', status: 'none', desc: '草稿箱与发布接口订阅号/服务号均可调用；个人主体权限存疑，需实测', scenes: ['私域复购', 'B 端获客'] },
  { id: 'wecom', name: '企业微信', cat: 'C', tier: 'enterprise', status: 'none', desc: '熟人信任转化率最高；客户联系接口需企业认证 + 可信域名', scenes: ['私域 SOP'] },
  { id: 'facebook', name: 'Facebook 主页', cat: 'C', tier: 'audit', status: 'none', desc: '30 亿 MAU；Graph API 生产需 App Review + 企业验证', scenes: ['海外本地商户'] },
  { id: 'instagram', name: 'Instagram', cat: 'C', tier: 'audit', status: 'none', desc: '需专业号 + 绑定 FB 主页 + App Review；约 50 帖/24h', scenes: ['服饰美妆 DTC'] },
  { id: 'threads', name: 'Threads', cat: 'C', tier: 'audit', status: 'none', desc: 'Threads API 需 App Review；约 250 帖 + 1000 回复/24h', scenes: ['品牌互动'] },
  { id: 'linkedin', name: 'LinkedIn', cat: 'C', tier: 'audit', status: 'none', desc: 'B2B 决策者；Marketing API 需企业主页管理员 + 公司审核', scenes: ['B 端线索'] },
  { id: 'pinterest', name: 'Pinterest', cat: 'C', tier: 'audit', status: 'none', desc: '搜索型长尾流量；API 先 Trial 后 Standard，需审核', scenes: ['家居时尚'] },
  { id: 'whatsapp', name: 'WhatsApp Business', cat: 'C', tier: 'enterprise', status: 'none', desc: 'Cloud API 需企业主体 + 商业验证 + 消息模板审核', scenes: ['跨境客服'] },
  { id: 'taobao', name: '淘宝 / 天猫', cat: 'D', tier: 'enterprise', status: 'none', desc: '最大货架电商；个人仅商品只读，订单接口需企业并入聚石塔', scenes: ['自营店铺'] },
  { id: 'jd', name: '京东', cat: 'D', tier: 'enterprise', status: 'none', desc: '3C 家电强、信任度高；宙斯商家应用需企业 + 卖家 OAuth', scenes: ['高客单自营'] },
  { id: 'pdd', name: '拼多多', cat: 'D', tier: 'enterprise', status: 'none', desc: '低价下沉；自研需企业 + 商家 Token + 预充值', scenes: ['白牌工厂'] },
  { id: 'alibaba1688', name: '1688', cat: 'D', tier: 'enterprise', status: 'none', desc: 'B2B 批发源头厂货；订单与实时库存需企业实名', scenes: ['选品代发'] },
  { id: 'douyin-shop', name: '抖店', cat: 'D', tier: 'enterprise', status: 'none', desc: '内容电商闭环；仅企业/个体户，云内计费', scenes: ['直播工具'] },
  { id: 'kuaishou-shop', name: '快手电商', cat: 'D', tier: 'enterprise', status: 'none', desc: '商家/服务商需企业或个体户，达人可个人实名', scenes: ['直播分销'] },
  { id: 'wechat-shop', name: '微信小店', cat: 'D', tier: 'enterprise', status: 'none', desc: '微信内电商闭环；开店仅企业/个体户', scenes: ['私域自营'] },
  { id: 'xhs-shop', name: '小红书商城', cat: 'D', tier: 'enterprise', status: 'none', desc: '开放平台面向电商 ISV，服务商需企业；授权 30/90 天', scenes: ['达人选品'] },
  { id: 'amazon', name: 'Amazon', cat: 'D', tier: 'enterprise', status: 'none', desc: '全球购买意图最强；SP-API 需专业卖家账号 + App 审核', scenes: ['跨境品牌'] },
  { id: 'ebay', name: 'eBay', cat: 'D', tier: 'official', status: 'none', desc: '开发者计划免费、个人可注册；生产 Keyset 需审核', scenes: ['二手长尾'] },
  { id: 'etsy', name: 'Etsy', cat: 'D', tier: 'official', status: 'none', desc: 'Open API v3 个人可建 App；商用需 Commercial Access', scenes: ['手作定制'] },
  { id: 'shopify', name: 'Shopify', cat: 'D', tier: 'enterprise', status: 'none', desc: '独立站 SaaS，本身不带流量；公开 App 需审核', scenes: ['品牌独立站'] },
  { id: 'shopee', name: 'Shopee', cat: 'D', tier: 'enterprise', status: 'none', desc: '东南亚；Open Platform 须卖家/Partner + App 审核', scenes: ['东南亚卖家'] },
  { id: 'lazada', name: 'Lazada', cat: 'D', tier: 'enterprise', status: 'none', desc: '东南亚品牌化；须卖家/ISV 注册 + 资质认证', scenes: ['东南亚品牌'] },
  { id: 'walmart', name: 'Walmart Marketplace', cat: 'D', tier: 'enterprise', status: 'none', desc: '竞争小于 Amazon；须先获批卖家，ISV 走 Solution Provider', scenes: ['美国合规供应链'] },
  { id: 'temu', name: 'Temu', cat: 'D', tier: 'enterprise', status: 'none', desc: '全托管低价；须卖家/服务商主体，API 开放度低', scenes: ['低价标品'] },
  { id: 'shein', name: 'SHEIN', cat: 'D', tier: 'enterprise', status: 'none', desc: '快时尚跨境；须卖家身份 + 开发者协议、账号分级认证', scenes: ['服装供应链'] },
  { id: 'taobao-union', name: '淘宝联盟', cat: 'E', tier: 'cps', status: 'none', desc: '个人达人可备案注册；转链 + 推广位 + 订单归因（个人不可申请 appkey）', scenes: ['选品导购'] },
  { id: 'jd-union', name: '京东联盟', cat: 'E', tier: 'cps', status: 'none', desc: '个人可实名；3C 家电等高客单返利路径清晰', scenes: ['3C 家电'] },
  { id: 'pdd-union', name: '多多进宝', cat: 'E', tier: 'cps', status: 'none', desc: '低价下沉，转链与选品；自研应用侧需企业', scenes: ['白牌工厂'] },
  { id: 'meituan-union', name: '美团联盟', cat: 'E', tier: 'cps', status: 'none', desc: '到店团购券 CPS，个人推手可实名注册', scenes: ['本地到店'] },
  { id: 'amazon-assoc', name: 'Amazon Associates', cat: 'E', tier: 'cps', status: 'none', desc: '个人可注册（需站点/流量审核），追踪 ID 归因', scenes: ['跨境导购'] },
  { id: 'douyin-union', name: '抖音精选联盟', cat: 'E', tier: 'enterprise', status: 'none', desc: '达人分销；达人需实名，商家侧需企业/个体户', scenes: ['达人带货'] },
  { id: 'ks-fenxiao', name: '快手快分销', cat: 'E', tier: 'enterprise', status: 'none', desc: '直播分销；商家/服务商需企业或个体户', scenes: ['直播分销'] },
  { id: 'wx-union', name: '微信优选联盟', cat: 'E', tier: 'enterprise', status: 'none', desc: '小店商品分销；需已开通小店（企业/个体户）', scenes: ['私域分销'] },
  { id: 'xianyu', name: '闲鱼', cat: 'F', tier: 'enterprise', status: 'none', desc: '二手 C2C；开放平台须企业账号 + 聚石塔部署，无成熟 CPS', scenes: ['清库存'] },
  { id: 'meituan', name: '美团 / 大众点评', cat: 'F', tier: 'enterprise', status: 'none', desc: '本地生活到店到家；开放平台须企业，联盟个人可实名', scenes: ['到店导购'] },
  { id: 'eleme', name: '饿了么', cat: 'F', tier: 'enterprise', status: 'none', desc: '服务商须法人/组织；CPS 走淘宝联盟', scenes: ['外卖 CPS'] },
  { id: 'zhuanzhuan', name: '转转', cat: 'F', tier: 'automation', status: 'none', desc: '二手交易；无面向第三方的发布 API', scenes: ['二手清货'] },
  { id: 'hema', name: '盒马', cat: 'F', tier: 'automation', status: 'none', desc: '即时零售；未见公开开放平台/联盟（待核实）', scenes: ['供货'] },
  { id: 'gbp', name: 'Google Business Profile', cat: 'F', tier: 'official', status: 'none', desc: '海外本地搜索/地图直接露出，有 Business Profile API', scenes: ['海外门店'] },
  { id: 'tencent-ads', name: '腾讯广告', cat: 'G', tier: 'official', status: 'none', desc: '官方资质明确支持个人开户（身份证）；特殊行业需许可证，外链需 ICP', scenes: ['私域引流'] },
  { id: 'google-ads', name: 'Google Ads', cat: 'G', tier: 'official', status: 'none', desc: 'developer token 2026-09-09 停用，改按 GCP 项目授权；Basic 需品牌验证', scenes: ['出海搜索获客'] },
  { id: 'microsoft-ads', name: 'Microsoft Ads', cat: 'G', tier: 'official', status: 'none', desc: '开发者令牌易得，沙盒有通用令牌；Bing 流量 CPC 低', scenes: ['北美 B2B'] },
  { id: 'oceanengine', name: '巨量引擎', cat: 'G', tier: 'enterprise', status: 'none', desc: '国内最大投放池；需营业执照/行业资质，落地页需 ICP', scenes: ['规模化起量'] },
  { id: 'alimama', name: '阿里妈妈', cat: 'G', tier: 'enterprise', status: 'none', desc: '电商站内广告，必须绑定店铺主体', scenes: ['电商转化放大'] },
  { id: 'jingzhuntong', name: '京准通', cat: 'G', tier: 'enterprise', status: 'none', desc: '京东站内广告，需店铺主体', scenes: ['京东站内'] },
  { id: 'pdd-ads', name: '多多推广', cat: 'G', tier: 'enterprise', status: 'none', desc: '拼多多站内广告，需店铺主体', scenes: ['拼多多站内'] },
  { id: 'amazon-ads', name: 'Amazon Ads', cat: 'G', tier: 'enterprise', status: 'none', desc: '需广告账号 + 开发者申请，无店难接入', scenes: ['零售媒体'] },
  { id: 'meta-ads', name: 'Meta Ads', cat: 'G', tier: 'audit', status: 'none', desc: 'Marketing API 需建 App + 企业验证 + App Review', scenes: ['海外 2C'] },
  { id: 'tiktok-ads', name: 'TikTok Ads', cat: 'G', tier: 'audit', status: 'none', desc: 'Business API 需企业广告账号 + 开发者 App 审核', scenes: ['出海 App'] },
  { id: 'producthunt', name: 'Product Hunt', cat: 'H', tier: 'official', status: 'none', desc: 'API v2 默认只读，写入需申请，禁商用；榜单放大器效应', scenes: ['SaaS 冷启动'] },
  { id: 'hackernews', name: 'Hacker News', cat: 'H', tier: 'official', status: 'none', desc: '官方 Firebase API + Algolia 无需鉴权；反营销文化', scenes: ['开源技术产品'] },
  { id: 'github', name: 'GitHub', cat: 'H', tier: 'official', status: 'none', desc: 'REST/GraphQL 个人免费；开发者聚集、SEO 强', scenes: ['开源开发者工具'] },
  { id: 'devto', name: 'Dev.to', cat: 'H', tier: 'official', status: 'none', desc: 'Forem API 个人设置页取 Key，免费', scenes: ['技术内容营销'] },
  { id: 'reddit', name: 'Reddit', cat: 'H', tier: 'official', status: 'none', desc: 'Data API OAuth，免费额度有限，商用需付费协议', scenes: ['垂类社区'] },
  { id: 'appstore', name: 'App Store', cat: 'H', tier: 'official', status: 'none', desc: 'Connect API，需 Apple 开发者计划（$99/年）', scenes: ['iOS App'] },
  { id: 'googleplay', name: 'Google Play', cat: 'H', tier: 'official', status: 'none', desc: 'Play Developer API，需 Play Console 账号', scenes: ['Android App'] },
  { id: 'aws-marketplace', name: 'AWS Marketplace', cat: 'H', tier: 'enterprise', status: 'none', desc: '须卖家注册 + 税务银行 + 产品审核；企业采购通道', scenes: ['B 端 SaaS'] },
  { id: 'cloud-marketplace', name: '阿里云 / 腾讯云 Marketplace', cat: 'H', tier: 'enterprise', status: 'none', desc: '需云厂商合作伙伴资质与企业主体', scenes: ['国内 B 端 SaaS'] },
]
