# Kimi 1.4.0 / Magpie 1.0.0

- 拆为两个独立插件，分别显示自己的配置，移除接入方式选择器。
- Kimi 保留原插件标识与已有 Kimi 配置字段；只接入 Kimi 官方 API。
- Magpie 使用新标识，独立保存网关地址、密钥、模型、推理强度、Token 上限和提示词。
- 两个插件继续支持流式翻译、润色、自定义 Prompt、取消和截断错误提示。
- 旧合并版的 Magpie 服务需在新插件下重新添加，并手动复制自定义设置，详见 README。

安装包：`kimi-translate-1.4.0.bobplugin` 与 `magpie-1.0.0.bobplugin`。本次不发布 Release，不更新公开 appcast。

2026-10-14 验证：26 项 Node VM 测试及两份 ZIP 完整性检查通过。独立 Magpie 插件通过 Node HTTP 适配器真实验证模型列表及流式翻译，`Hello, world.` 返回「你好，世界。」。尚未在 Bob 内安装或验证界面，本次未调用 Kimi 官方 API。

# Kimi 翻译 1.3.0

- 新增本地 Magpie 网关模式，默认地址 `http://127.0.0.1:3425/v1`、模型 `group/smart-easy`。
- 支持独立网关密钥、自由填写模型 ID 和可选推理强度；本机无需鉴权时可留空密钥。
- Magpie 请求不发送 Kimi API Key 或 `thinking` 参数。
- 保留原插件标识、Kimi 接入及翻译／润色／自定义 Prompt；已有服务需主动切换接入方式。

本地安装包为 `kimi-translate-1.3.0.bobplugin`。2026-10-14：22 项 Node VM 测试通过，ZIP 完整性检查通过；通过 Node HTTP 适配器运行插件代码，真实验证本地网关模型列表与 `group/smart-easy` 流式翻译（`Hello, world.` →「你好，世界。」）。尚未在 Bob 内安装或验证界面显示。本次未发布 Release，自动更新清单保留已发布版本。

# Kimi 翻译 1.2.2

- 支持流式翻译、原语言润色和自定义 Prompt。
- 支持 System Prompt、User Prompt 和输入文本／语言变量。
- 修复流式回调结构，逐次显示累计输出。
- 配置 Bob 自动更新地址，保留既有插件标识。

下载附件 `kimi-translate-1.2.2.bobplugin`，双击安装后在 Bob 的文本翻译服务中添加 Kimi 翻译，填写自己的 API Key。最低要求 Bob 1.8.0。

验证：16 项 Node VM 模拟测试通过，ZIP 完整性检查通过。尚未完成 Bob 内实际翻译及真实 Kimi API 调用验收。文本与密钥直接发送至 api.moonshot.cn，API 费用由服务商按账户计费。
