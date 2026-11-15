# Flame in Freefall 后端入口

结构沿用 Impact Watch：从含 `index.html` 的项目根目录运行，仅用 Python 标准库。

```powershell
python -m backend check                          # 校验 scenarios.json、页面脚本引用、import map
python -m backend build ..\flame-release          # 生成 Vercel 发布目录（含 vercel.json）
python -m backend build ..\flame-static --host static
```

- `contracts.py`：校验场景数据契约（slug 唯一、必须有 earth、颜色/角度范围、flame 五个字段、每条 fact 必须带 `src`），以及 `index.html`、`kitchen/*.js` 引用的文件都存在。
- `release.py`：显式白名单复制公开文件，并删掉 `main.js` 末尾的 `window.__kitchen` 调试句柄。**新增运行时文件必须加入 `FILES`。**
- `science/`：离线算法占位。火焰形态目前是 `scenarios.json` 里的示意参数（schematic），不是计算结果；换成数据驱动时在 `__main__.py` 的 `JOBS` 注册脚本。
- `data/scenarios.json` 的 `facts[].src` 只有三种语义：具体来源名、`schematic`（示意）、`unverified`（未验证）。前端会把后两种显示成标签。

## 地表模型

`models/planet_surfaces/{moon,mars}.glb` 来自 Tony 的 Blender 脚本 `generate_surfaces.py`（原件在 `Flame_in_Freefall_2026/09_assets/frontend_models/planet_surfaces`）。重新生成后同名替换即可。
`scenarios.json` 的 `terrain.offset` 是厨房在该地块上的落点：对每个 GLB 做 0.5 m 网格高度搜索，取厨房占地内高度起伏最小、无岩石、尽量居中的位置。换了模型要重算。
前端在加载时把每块地形切成约 8 m 的瓦片，相机视锥外的瓦片不绘制；只在当前或目标场景用到时显示该星球地形。
