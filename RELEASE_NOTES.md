# Kimi 翻译 1.2.2

- 支持流式翻译、原语言润色和自定义 Prompt。
- 支持 System Prompt、User Prompt 和输入文本／语言变量。
- 修复流式回调结构，逐次显示累计输出。
- 配置 Bob 自动更新地址，保留既有插件标识。

下载附件 `kimi-translate-1.2.2.bobplugin`，双击安装后在 Bob 的文本翻译服务中添加 Kimi 翻译，填写自己的 API Key。最低要求 Bob 1.8.0。

验证：16 项 Node VM 模拟测试通过，ZIP 完整性检查通过。尚未完成 Bob 内实际翻译及真实 Kimi API 调用验收。文本与密钥直接发送至 api.moonshot.cn，API 费用由服务商按账户计费。
