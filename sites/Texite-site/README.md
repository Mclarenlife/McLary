# Texite 交互官网

本地目录：`D:\Project\website develop\sites\Texite site`。已部署：https://mclarenlife.github.io/texite/ 。

## 打开

双击 `START.cmd`。默认地址 http://127.0.0.1:5192/ 。终端保持开启，Ctrl+C 停止。
已包含构建好的工作区，无需安装依赖即可预览。不要双击 HTML 以 file:// 打开。

## 这次的实现

- 13 英寸 iPad Pro 横向模型：黑色等宽边框、金属边缘、横向摄像头；屏幕为 4:3。
- 设备内直接复用 Texite 的 React 前端组件及样式，逻辑画布为 1200 × 900。
- 实际 CodeMirror、Visual、文件树、连续 PDF、历史恢复、项目备份、AI 差异窗口；不是截图拼接或旧版简化仿制。
- 演示鼠标沿轨迹移动，点击有反馈，输入逐字进行，外部字幕说明步骤。可停止并直接接手。
- 编辑、右键与行内 AI、项目搜索、快捷引用、历史与备份、AI 助手、设置七段流程；播放前备份，跨场景保持文稿。

## 文件

- `index.html` / `styles.css`：网站布局、iPad Pro 外观、响应式设计。
- `app.js`：滚动场景、播放控制与 iframe 通信。
- `workbench/`：可直接部署的 Texite 体验工作区。
- `workbench-src/`：工作区源码。`packages/` 来自本地 Texite；`main.tsx` 是网页适配层；`tour.ts` 驱动真实组件；`fixtures.ts` 核对预编译 PDF。
- `guide.html`：完整体验范围。
- `DEMO-STORYBOARD.md`：七段演示的操作顺序、结果与预设边界。
- `qa/REVIEW.md`：验证结果和待人工验收项。
- `qa/check.mjs`：示例替换、编译映射、静态资源、通信边界的自动检查。

旧的 `renderer.js` 保留作历史实现参考，当前页面与新构建均不再使用。

## 边界

网页没有 TeX 引擎。点击编译会回放预制示例 PDF 作为模拟结果；自定义修改也不会因缺少引擎而跳到失败诊断。PDF 面板持续标注“网页未加载编译器，结果为模拟演示”。模拟结果不保证与自定义源码一致，正式文稿请在桌面版编译。

AI 是本地预设操作，不调用模型；仍通过 Texite 自身的修改、差异、撤回流程完成。
网页数据保存在独立 IndexedDB，不读取本机 Texite 文件。清理浏览器数据会删除体验记录，重要内容请导出 ZIP。
iPad Pro 仅为展示容器，不代表已提供 iPadOS 应用。

## 构建与维护

外层网站：`npm run check`、`npm run build`，输出 `dist/`，包含已构建的 `workbench/`。

若修改工作区：进入 `workbench-src`，安装 package.json 中的依赖，然后执行 `npm run build`；输出到上一级 `workbench/`。再回外层运行构建。
工作区源码是独立副本，不会修改 Texite 应用源文件。后续同步应用更新时，请保留网页适配层、数据库命名隔离和预设 AI 标签。

官网继续使用原版 MiSans 与 Inter；内嵌工作区使用真实软件的系统 UI 字体与 JetBrains Mono。
尺寸依据：[Apple iPad Pro 技术规格](https://www.apple.com/ipad-pro/specs/)中 13 英寸屏幕 2752 × 2064 的比例。

## 字号与导航更新（2026-10-23）

第 07 项使用真实设置窗口，依次介绍外观与主题、界面字号、编辑器文字、编译设置、同步与存储和关于；只浏览，不修改用户偏好。滚动切换时自动打开/关闭演示打开的设置窗。浏览器无 WebDAV 接口，因此同步分类保留桌面版使用说明，不伪装成功连接。

顶栏“模板下载”打开 templates.html，显示“暂未开发”；“作者主页”在新标签页打开 https://mclarenlife.github.io/ 。theme.js 使用月亮/太阳图标表达下次切换动作，并保存偏好。

typography.css 是官网统一字号层：正文 18px，导航与按钮 16px，辅助说明至少 14px（浏览器默认根字号 16px 时）。使用 rem，正文行高 1.8。保留 MiSans / Inter。小屏导航换行、功能导航两行展示；手机上设备不吸顶，避免增大字号后遮挡正文。内嵌软件维持原始样式，可通过放大按钮查看。

依据（2026-10-23 查阅）：
- IBM Carbon expressive 网站正文基准 16px、标签 14px：https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets
- GOV.UK 正文 19px、小正文 16px：https://design-system.service.gov.uk/styles/type-scale/
- WCAG 2.2 要求文字可放大到 200% 而不丢失内容/功能，并不规定统一最小字号：https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html

18/16/14 是结合此页中文长段落、功能说明与控制区做的设计选择，不是宣称 WCAG 达标。200% 缩放与完整动画仍需浏览器人工验收。
