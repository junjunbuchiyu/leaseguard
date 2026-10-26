# 租约体检 · LeaseGuard

> 上传或拍一张租房合同，60 秒告诉你哪几条会坑你、依据哪条法、以及怎么跟房东谈。

面向首次租房大学生的 **AI 合同风险审查 Web 应用**。基于《民法典》租赁合同章与 2025-09-15 施行的《住房租赁条例》（国务院令第 812 号），用大模型 + RAG 把一份倾斜的合同翻译成"能看懂、能谈、有依据"的风险清单。

> 2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 · AI WEB 网页开发挑战赛 参赛作品

---

## 为什么做

大学生第一次租房，拿到的是房东或中介拟好的合同：押金扣减情形不写、维修责任全归租客、"可随时进入房屋"、提前解约扣两个月租金。看不懂、不敢问、也不知道哪条其实能谈。

2025 年 9 月《住房租赁条例》施行后，押金返还时限、非居住空间不得出租、转租资金监管等都有了明确依据——但没有人把它翻译成"你这份合同第 7 条有问题"。

LeaseGuard 做的就是这件事。

## 核心能力

| 能力 | 状态 |
|---|---|
| 合同解析：图片拍照 / PDF / 粘贴文本 | 🚧 开发中 |
| 本地 PII 脱敏（身份证、手机号、银行卡、门牌号） | 🚧 开发中 |
| 条款切分与分类（押金/维修/解约/转租/费用/隐私…） | 🚧 开发中 |
| 风险分级 + 法条引用溯源（RAG） | 🚧 开发中 |
| 建议改法 + 谈判话术 | 🚧 开发中 |
| 体检报告导出 | 🚧 开发中 |
| Agent 步骤可视化 / MCP Server / 语音播报 | 📋 规划中 |

设计细节见 [`docs/PRD.md`](docs/PRD.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Nuxt 3（Vue 3 + Nitro） |
| AI | Vercel AI SDK + DeepSeek `deepseek-flash`（含图像理解） |
| 样式 | Tailwind CSS |
| 状态 | Pinia |
| 校验 | zod |
| 检索 | 本地 BM25 + 向量余弦（内存索引，无外部向量库） |
| 报告 | 浏览器打印（`@media print`） |

## 快速开始

```bash
# 1. 安装依赖（Node.js >= 20）
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 NUXT_DEEPSEEK_API_KEY

# 3. 启动开发服务器
npm run dev        # http://localhost:3000
```

生产构建：

```bash
npm run build
node .output/server/index.mjs
```

## 法规数据

风险判定不靠模型凭记忆背法条，而是**检索 + 引用**。语料是 116 条与住房租赁直接相关的条文：

| 法规 | 层级 | 条数 |
|---|---|---|
| 《民法典》（租赁合同章 + 合同通则相关条） | 法律 | 38 |
| 《住房租赁条例》（2025-09-15 施行） | 行政法规 | 50 |
| 《商品房屋租赁管理办法》 | 部门规章 | 28 |

```bash
npm run data:fetch   # 从官方页面抓取原文 -> data/raw/*.txt
npm run data:build   # 解析、打标签、校验 -> data/laws.json + data/laws.meta.json
```

构建脚本会做完整性校验：条号连续、无重复 id、正文不混入页面噪音、每条都带来源链接。产物随仓库提交，评审无需联网即可复现。

法规与合同条款共用同一套标签（`data/clause-tags.json`），检索时才能按类别对齐——否则「押金」条款可能召回「押金」以外的条文。

## 条款切分与分类

合同文本先规范化，再按三级策略切分：`第X条` → 数字编号 → 空行分段，都不成立才按 300 字兜底分块。每条条款保留字符偏移量，前端可直接高亮定位。

分类走两级：关键词规则打底（零成本、可解释），置信度低于 0.5 的条款才交给 `deepseek-flash` 复核，模型只做选择题，输出经 zod 校验。

## 法规检索

索引在进程内构建，116 条法规启动即刻就绪，单次查询 1–20ms。得分由三路组成：

| 分量 | 权重 | 作用 |
|---|---|---|
| BM25（字符二元组） | 0.65 | 词面匹配，不依赖分词词典 |
| 哈希向量余弦 | 0.20 | 补充二元组之外的分布相似 |
| 标签命中 | 0.15 | 让查询意图与条文类别对齐 |

外面再套一层同义词扩展（房东→出租人、跑路→资金监管、进门→擅自进入），解决"口语 vs 法条用词"的不对称。扩展词只算半票，不能盖过用户原话。

**为什么不用向量库和 embedding 模型**：语料只有 116 条、平均 93 字，全量进内存才几十 KB；评审机器不必装 pgvector，也不用下载 90MB 的模型。中文短文本上 BM25 + 同义词已经够用，引入模型反而让复现变难。

```bash
node scripts/eval-retrieval.mjs   # 10 条口语查询，看 Top-1 / Top-5 命中
```

当前成绩：**Top-1 7/10，Top-5 10/10**（用例在 `data/retrieval-cases.json`）。

## 审查管线

每条条款：检索 5 条候选法条 → 模型判定等级与问题 → 为高/中风险生成改法与谈判话术。

**防编造的三道闸**（这是产品可信度的底线）：

1. `lawId` 必须出现在该条款的候选列表里，否则丢弃；
2. `quote` 必须是该法条原文的连续片段，拼不出来就丢弃该引用；
3. zod 校验失败整批重试一次，仍失败则该条标记「待人工复核」，不阻塞整体。

性能：判定按 5 条一批、2 路并发；建议只对 high/medium 生成。一份 10 条条款的合同约 **3–5 次调用、10–14 秒**。

提示词里固定了三条经验：脱敏占位符（如【门牌号1】）不代表信息缺失；只判断给定条款本身、不因「合同缺少某类条款」扣分；给一份条款概览作为上下文，避免把「已写在别处」误判成「没约定」。

## 工作台与流式

两个接口都用 SSE，让「AI 在做什么」可见，而不是一个转圈：

```
解析  POST /api/audit/parse/stream    extract → redact → split → classify → done
审查  POST /api/audit/stream          retrieve → judge（每批推 risk）→ advise（同 id 更新）→ score → done
```

前端用 `fetch` + `ReadableStream` 手写解析（`EventSource` 只支持 GET，带不了请求体）。效果是上传后能看到「识别文字 → 遮盖 5 处 → 切出 10 条 → 分类打标」，审查时**第 4 秒就能看到第一批风险**；顶部步骤时间线显示真实耗时，不是假动画。

工作台三栏：合同原文（左侧风险色条，未判定时呼吸闪烁）／风险清单／条款详情（依据原文、改法、建议条款、可复制的谈判话术）。详情底部还有「这条检索到的候选法条」——列出该条款召回的 5 条法规与得分，被引用的那条标「已引用」，这是 RAG 最直接的证据。

审查过程中，头部会滚动显示 **AI 调用轨迹**（每次检索、每批判定、每次建议生成，带时间戳与耗时），事后也是一份可回看的执行记录。

审查结果存在内存会话里，刷新页面直接读回，不重复花模型调用；`/report?doc=` 是打印友好的报告页，用 `@media print` 隐藏按钮与阴影后可直接导出 PDF。

首页提供两份样张（坑版 / 规范版）一键体验，不用先去找合同文件；下方「最近审查」列出本次服务运行期间的合同与体检分，点一下就能回到上次的结果（服务重启即清空，与不落盘一致）。

报告页在明细之前先给一段**整体总结**：问题集中在哪几类、结论是什么、优先协商哪三条、下一步做什么——评委和用户都不用自己从十几条风险里归纳。

## MCP Server

应用里的三个能力同时以标准 MCP 工具暴露，任何 MCP 客户端都能直接调用：

| 工具 | 作用 |
|---|---|
| `search_law` | 检索本地法规库（116 条），返回条号、原文、官方链接 |
| `calc_penalty` | 按租金月数折算违约金，并对照实际损失判断是否偏高 |
| `redact_pii` | 本地脱敏，返回遮盖后的文本与统计 |
| `law_stats` | 法规库收录范围 |

```bash
npm run mcp        # 以 stdio 启动（tsx 直接跑 TS，复用 server/utils，不复制逻辑）

# 用官方 inspector 逐个点：
npx @modelcontextprotocol/inspector node node_modules/tsx/dist/cli.mjs mcp/server.ts
```

stdio 模式下 stdout 是协议通道，所以服务端日志一律走 stderr——写 MCP 服务最容易踩的坑就是这个。

## 测试

```bash
npm run dev                     # 另开一个终端
node scripts/smoke.mjs          # 解析 → 切分 → 分类
node scripts/eval-retrieval.mjs # 检索 Top-1 / Top-5
node scripts/eval-review.mjs    # 审查召回率与误报率（会真实调用模型，约 1 分钟）
npm run test:mcp                # 启动 MCP Server 并调用全部工具
```

冒烟测试检查的不变量：偏移量能精确还原条款原文、条款之间不重叠、标签都在枚举内、样张里预埋的条款号都能切出来。

审查评估的口径：预埋为 high/medium 的条款被标为 high/medium 即算命中；误报只统计「预埋清单之外的条款被判成 high」——宁可保守一点，不把谨慎当错误。

样张在 `data/samples/`，预埋问题清单见 `expected.json`。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `NUXT_DEEPSEEK_API_KEY` | 是 | — | DeepSeek 开放平台 API Key，仅服务端读取 |
| `NUXT_DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | API 地址 |
| `NUXT_DEEPSEEK_MODEL` | 否 | `deepseek-flash` | 主模型 |

> Key 只存在于服务端 `runtimeConfig`，不会下发到浏览器；`.env` 已被 `.gitignore` 忽略。

## 部署

建议跑**常驻 Node 进程**，不要用 serverless：会话存在内存里、SSE 需要长连接，冷启动会把会话清空。

```bash
# Docker
docker build -t leaseguard .
docker run -d -p 3000:3000 -e NUXT_DEEPSEEK_API_KEY=sk-xxx leaseguard

# 或直接跑构建产物
npm ci && npm run build
NUXT_DEEPSEEK_API_KEY=sk-xxx node .output/server/index.mjs
```

Zeabur / Railway / 轻量服务器都可以，设好 `NUXT_DEEPSEEK_API_KEY` 即可。Vercel 这类 serverless 平台能跑，但 SSE 与内存会话会退化（请求可能落在新实例上），演示前务必实测一遍。

## 目录结构

```
.
├─ pages/            # 页面（首页 / 审查工作台 / 报告 / 法规库）
├─ components/       # 组件（upload / audit / ui）
├─ stores/           # Pinia 状态
├─ server/
│  ├─ api/           # Nitro 接口（parse / stream / law / report）
│  └─ utils/         # 检索、脱敏、切分、提示词、评分
├─ scripts/          # 法规抓取、构建、冒烟、检索与审查评估、MCP 测试
├─ data/             # 法规库、标签体系、样张合同、检索用例
├─ mcp/              # MCP Server（stdio）
└─ docs/             # 需求文档
```

## 开发计划

- [x] M0 工程脚手架（Nuxt 3 + Tailwind + Pinia）
- [x] M1 数据层：116 条法规库（抓取 / 解析 / 打标签 / 校验）
- [x] M2 合同解析与本地脱敏（视觉 / PDF / 粘贴）
- [x] M3 条款切分与分类（规则 + LLM 复核）
- [x] M4 法规检索（BM25 + 向量 + 标签）与法规库页
- [x] M5 审查管线（判定 + 约束式引用 + 改法话术）
- [x] M6 工作台、SSE 流式与报告导出
- [x] M7 MCP Server 与语音播报
- [ ] M8 公网部署、演示视频与技术文档

## 免责声明

本工具基于公开法规对合同文本做**风险提示**，不构成法律意见，也不替代执业律师。重大权益事项请咨询专业人士或当地住建部门。

## 团队

2026 第九届传智杯 AI WEB 赛道
