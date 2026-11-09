# 🗳️ US Election Simulator — 美国大选模拟平台

基于群代理（Group Agent）方法的美国大选模拟平台。用户输入选举事件，系统生成51个州级群代理，模拟各州人群的情绪态度演变，最终预测选举结果。

## 快速启动

### 1. 启动后端（端口 8000）

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动前端（端口 5173）

```bash
cd frontend
npm install
npm run dev
```

### 3. 打开浏览器

访问 http://localhost:5173

## 使用流程

1. **📰 事件中心** — 点击"加载预设事件"导入2024大选关键事件
2. **⏱️ 时间线** — 点击"开始模拟"，观察事件逐步影响各州
3. **🗺️ 选举地图** — 查看各州颜色变化（红=共和党，蓝=民主党，紫=摇摆）
4. **👥 群代理** — 查看各州153个代理的详细属性和情绪态度
5. **📊 仪表盘** — 调节精细因子（情绪衰减、遗忘概率等），观察影响
6. **📋 预测报告** — 查看最终预测结果和摇摆州对比

## 核心算法

### 情绪更新
```
E_new = E_old × (1 - fading) + impact × character_weight × population_weight
```

### 态度更新
```
A_new = A_old × (1 - forgetting) + emotion_component + positive_shift
```

### 选举预测
- 各州3个代理（共和党/民主党/独立选民）按人口加权投票
- 态度差值超过阈值 → 预测该党获胜
- 未超过阈值 → 沿用2020结果

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design |
| 图表 | Recharts |
| 后端 | Python FastAPI |
| 实时通信 | WebSocket |
| 模拟引擎 | 规则引擎（可切换为Ollama LLM） |

## 项目结构

```
election-sim/
├── frontend/src/
│   ├── pages/          # 6个板块页面
│   ├── store/          # Zustand全局状态
│   ├── types/          # TypeScript类型定义
│   └── utils/api.ts    # API调用封装
├── backend/
│   ├── main.py         # FastAPI入口 + WebSocket
│   ├── models/         # 数据模型(群代理/事件/模拟)
│   ├── engine/         # 模拟引擎(生成器/决策/LLM接口)
│   └── data/           # 51州数据 + 2020选举结果 + 预设事件
```
