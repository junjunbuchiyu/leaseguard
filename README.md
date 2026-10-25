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

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `NUXT_DEEPSEEK_API_KEY` | 是 | — | DeepSeek 开放平台 API Key，仅服务端读取 |
| `NUXT_DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | API 地址 |
| `NUXT_DEEPSEEK_MODEL` | 否 | `deepseek-flash` | 主模型 |

> Key 只存在于服务端 `runtimeConfig`，不会下发到浏览器；`.env` 已被 `.gitignore` 忽略。

## 目录结构

```
.
├─ pages/            # 页面（首页 / 审查工作台 / 报告 / 法规库）
├─ components/       # 组件（upload / audit / ui）
├─ stores/           # Pinia 状态
├─ server/
│  ├─ api/           # Nitro 接口（parse / stream / law / report）
│  └─ utils/         # 检索、脱敏、切分、提示词、评分
├─ data/             # 法规库、样例合同
├─ mcp/              # MCP Server
└─ docs/             # 需求文档
```

## 开发计划

- [x] M0 工程脚手架（Nuxt 3 + Tailwind + Pinia）
- [ ] M1 合同解析与本地脱敏
- [ ] M2 条款切分、分类与法规库检索
- [ ] M3 审查管线与风险工作台
- [ ] M4 报告导出与 Agent 步骤可视化
- [ ] M5 MCP Server、部署与演示

## 免责声明

本工具基于公开法规对合同文本做**风险提示**，不构成法律意见，也不替代执业律师。重大权益事项请咨询专业人士或当地住建部门。

## 团队

 2026 第九届传智杯 AI WEB 赛道
