# 🗳️ 美国大选模拟平台（US Election Simulator）

> 基于群代理（Group Agent）方法的美国大选模拟平台。用户输入选举事件，系统为 51 个州各生成 3 组群代理（共和党 / 民主党 / 独立选民），模拟人群情绪态度演变，最终预测选举结果。

平台为**三段式**结构，通过顶部年份切换或路由直达：

| 年份 | 路由 | 定位 |
|------|------|------|
| **2020 静态验证** | `/2020` | 以 2020 实际结果验证模型准确度（模拟 vs 实际逐州对比） |
| **2024 情绪波浪** | `/2024` | 2024 模拟预测 + 关键事件跨党派情绪波浪可视化 |
| **2026 互动模拟** | `/2026` | 用户输入事件，实时模拟（有后端→互动模拟；无后端→静态结果） |

---

## 一、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite 8 |
| UI 组件 | Ant Design 6（暗色主题） |
| 图表 | Recharts 3 |
| 地图 | d3-geo + topojson-client（美国州拓扑） |
| 状态管理 | Zustand 5 |
| 路由 | react-router-dom 7 |
| 后端 | Python FastAPI + Uvicorn |
| 实时通信 | WebSocket（`/ws/simulate`） |
| 模拟引擎 | 规则引擎（可切换为 Ollama LLM） |

---

## 二、目录结构

```
election-sim/
├── GUIDE.md                 ← 本文档（操作指南）
├── README.md                ← 原始简介
├── docs/                    ← 各年份代表截图（screenshot_2020/2024/2026.png）
│
├── frontend/                ← React + Vite 前端
│   ├── package.json         ← 依赖与脚本
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── index.html
│   ├── public/              ← 静态资源（地图拓扑、图标）
│   └── src/
│       ├── App.tsx          ← 路由（/2020 /2024 /2026，默认跳 /2020）
│       ├── main.tsx
│       ├── store/index.ts   ← Zustand 全局状态 + 静态数据加载
│       ├── types/index.ts   ← TypeScript 类型定义
│       ├── utils/api.ts     ← 后端 API 调用封装
│       ├── data/            ← 前端预计算数据（JSON）
│       ├── components/      ← 通用组件（USMap/EVTally/EventTimeline 等）
│       └── pages/
│           ├── StaticYearPage/        ← 2020 页
│           ├── StaticYearPage2024/    ← 2024 页
│           └── InteractivePage2026/   ← 2026 互动页
│
├── backend/                 ← Python FastAPI 后端
│   ├── requirements.txt
│   ├── main.py              ← 入口：REST API + WebSocket
│   ├── models/              ← 数据模型（agent / event / simulation）
│   ├── engine/              ← 模拟引擎（generator / decision / llm_interface）
│   └── data/                ← 51 州数据 + 历史结果 + 预设事件
│
└── scripts/                 ← 离线数据生成脚本（Python）
    ├── simulate_2026.py
    ├── simulate_2026_stepwise.py
    ├── monte_carlo_offline.py
    └── translate_events.py
```

---

## 三、数据文件清单

### 前端预计算数据（`frontend/src/data/`，启动时静态导入）
| 文件 | 说明 |
|------|------|
| `election_2020_results.json` | 2020 模拟 + 实际结果、关键事件、准确度（2020 页数据源） |
| `election_2024_results.json` | 2024 模拟 + 实际结果、事件、情绪波浪、准确度（2024 页数据源） |
| `election_2026_stepwise.json` | 2026 逐步模拟（9 个事件逐个叠加的地图快照序列，**store 默认加载为 2026 基线**） |
| `election_2026_ensemble.json` | 2026 蒙特卡洛集成结果 |
| `election_2026_comparison.json` | 2026 多方对比数据 |
| `election_2026_glm.json` | GLM 模型 2026 预测 |
| `election_2026_qwen.json` | Qwen 模型 2026 预测 |

### 前端公共资源（`frontend/public/`）
| 文件 | 说明 |
|------|------|
| `us-map.json` | 美国州 TopoJSON 拓扑（地图渲染用） |
| `election_2026_ensemble.json` | 2026 集成（public 副本） |
| `favicon.svg` / `icons.svg` | 图标 |

### 后端数据（`backend/data/`）
| 文件 | 说明 |
|------|------|
| `us_states.json` | 51 州基础数据（人口、选举人票等） |
| `election_2020.json` / `election_2024.json` | 历史选举结果（后端模拟基线） |
| `preset_events.json` | 预设事件（“加载预设事件”按钮数据源） |

---

## 四、环境要求

- **Node.js** ≥ 18（推荐 20+）
- **Python** ≥ 3.10（仅运行后端 / 离线脚本时需要）

---

## 五、安装与运行

### ✅ 方式 A：仅前端（静态模式，无需后端）
> 最快上手。2020 / 2024 页完整可用；2026 页在无后端时展示静态（逐步模拟）结果。

```bash
cd frontend
npm install      # 首次需安装依赖
npm run dev      # 启动开发服务器
```

浏览器访问 **http://localhost:5173**（默认跳转 `/2020`），或直达：
- http://localhost:5173/2020
- http://localhost:5173/2024
- http://localhost:5173/2026

### ✅ 方式 B：前后端完整（2026 实时互动模拟）
> 启用后端后，2026 页可自定义事件并实时观察模拟过程。

```bash
# 1) 启动后端（端口 8000）
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2) 另开终端启动前端（端口 5173）
cd frontend
npm install
npm run dev
```

2026 页会自动连接后端 WebSocket `/ws/simulate`，进入实时互动模式。

### 📦 生产构建
```bash
cd frontend
npm run build     # 输出到 frontend/dist/
npm run preview   # 本地预览构建产物
```

> ⚠️ `npm run build` 含 `tsc -b` 类型检查；当前代码库存在若干既有类型告警（`data.actual possibly undefined` 等），不影响 `npm run dev` 运行，但会导致 build 阶段报错。如需构建，可先按告警补充可选链（`?.`）或临时用 `npm run build -- --noTypeCheck` 跳过。

---

## 六、三个页面功能与操作方式

### 🗺️ /2020 静态验证
- **选举人票对比**（模拟 vs 实际）、**关键事件时间线**、**准确度统计**（州准确率 / 选举人票误差）
- **模拟方法论** 弹窗（4 步：群代理生成 → 事件驱动 → 情绪-态度更新 → 选举预测）
- **社会人口数据** 弹窗（党派注册 / 种族 / 职业分布）
- **地图交互**：点击任意州 → 弹出详情（人口 / 选举人票 / 模拟预测 / 实际结果 / 预测正确性）
- 顶部“查看实际 / 查看模拟”切换显示

### 🌊 /2024 情绪波浪
- 模拟 vs 实际对比、**翻转州（2020→2024）**、**州准确度列表**、**事件平均情绪**柱状图
- **情绪波浪面板**：关键事件如何跨越党派线影响选民情绪（喜悦 / 悲伤 / 愤怒 / 积极）
- **地图交互**：点击任意州 → 弹出详情（同 2020）；州准确度列表项亦可点击
- “查看实际 / 查看模拟”切换

### 🎮 /2026 互动模拟（6 大板块）
1. **📰 事件中心** — 点击“加载预设事件”导入 2026 关键事件，或手动添加
2. **⏱️ 时间线** — 点击“开始模拟”，观察事件逐步影响各州
3. **🗺️ 选举地图** — 各州颜色变化（红 = 共和党，蓝 = 民主党，紫 = 摇摆）
4. **👥 群代理** — 各州代理的详细属性与情绪态度；点击地图州查看该州代理
5. **📊 仪表盘** — 调节精细因子（情绪衰减 / 遗忘概率 / 性格特征开关等）
6. **📋 预测报告** — 最终预测结果与摇摆州对比

> 无后端时，2026 页展示 `election_2026_stepwise.json` 的静态逐步结果。

---

## 七、后端 API（FastAPI）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET / POST | `/api/events` | 获取 / 新增事件 |
| DELETE / PUT | `/api/events/{id}` | 删除 / 更新事件 |
| POST | `/api/events/preset` | 加载预设事件 |
| GET | `/api/agents` | 获取群代理（可按州过滤） |
| GET / PUT | `/api/factors` | 获取 / 更新精细因子 |
| GET | `/api/state` | 获取当前模拟状态 |
| GET | `/api/prediction` | 获取预测结果 |
| **WS** | `/ws/simulate` | 实时推送模拟进度与逐州预测 |

---

## 八、核心算法

**情绪更新**
```
E_new = E_old × (1 - fading) + impact × character_weight × population_weight
```

**态度更新**
```
A_new = A_old × (1 - forgetting) + emotion_component + positive_shift
```

**选举预测**
- 各州 3 个代理（共和党 / 民主党 / 独立选民）按人口加权投票
- 态度差值超过阈值 → 预测该党获胜
- 未超过阈值 → 沿用 2020 基线结果

---

## 九、离线脚本（`scripts/`）

| 脚本 | 用途 |
|------|------|
| `simulate_2026.py` | 生成 2026 单次模拟结果 |
| `simulate_2026_stepwise.py` | 逐步模拟：9 个事件逐个叠加，每事件后输出地图快照，上一快照 → 下一基线（生成 `election_2026_stepwise.json`） |
| `monte_carlo_offline.py` | 蒙特卡洛离线集成，多次采样汇总（生成 `election_2026_ensemble.json`） |
| `translate_events.py` | 事件文案翻译工具 |

运行示例：
```bash
cd scripts
python simulate_2026_stepwise.py
```

---

## 十、本打包文件清单

**包含**：全部源码（前端 `src` + 后端 + 脚本）、全部数据 JSON、配置文件（`package.json` / `requirements.txt` / `vite.config.ts` / `tsconfig`）、界面截图、本文档与原 README。

**已排除**（构建产物 / 依赖，非系统代码）：
- `frontend/node_modules/`（前端依赖，运行 `npm install` 自动重建）
- `frontend/dist/`（构建输出）
- `.git/`（版本控制元数据）
- `__pycache__/`、`*.pyc`（Python 缓存）

> 解压后按“第五节”执行 `npm install`（前端）与 `pip install -r requirements.txt`（后端）即可恢复运行环境。

---

## 十一、常见问题

- **端口不是 5175？** Vite 自动选择可用端口，默认 5173。如需固定，在 `frontend/vite.config.ts` 增加 `server: { port: 5175 }`。
- **2026 页是静态的、不能互动？** 需启动后端（方式 B）。无后端时只展示逐步模拟静态结果。
- **如何替换 2024 预测数据？** 编辑 `frontend/src/data/election_2024_results.json` 后前端热更新自动生效。
- **`npm run build` 报类型错误？** 见第五节生产构建说明，属既有类型告警，不影响 `npm run dev`。
