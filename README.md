# Kimi 翻译 · Bob 插件

安装包：上一级目录的 `kimi-translate-1.1.0.bobplugin`。

## 安装与使用

1. 双击安装包，在 Bob 中完成安装。
2. 在 Bob「设置 / 偏好设置 → 服务 → 文本翻译」添加「Kimi 翻译」。
3. 在 [Kimi 开放平台](https://platform.kimi.com/) 创建 API Key，填入插件的安全输入框。无需把密钥发给开发者。
4. 默认选择 Kimi K2.6、快速响应，点击验证以检查密钥和模型是否可用。
5. 启用此服务，使用 Bob 划词、截图识别后的文本或输入翻译。源语言与目标语言由 Bob 的选择和检测结果决定。

插件最低要求 Bob 1.8.0；本机检测到 Bob 1.20.0，使用其支持的 `toParagraphs` 格式。未进行 Bob 内安装及真实 API 翻译验证。

## 模式和自定义提示词

- **翻译**：按 Bob 选择的目标语言翻译，沿用原有默认行为。
- **润色**：修改语法和表达，保留原语言。
- **自定义 Prompt**：完全使用你填写的角色设定和用户指令，可用于总结、解释、问答、写作等，不附加任何内置翻译提示词。

角色设定（System Prompt）可留空；用户指令（User Prompt）默认或留空时为 `$query.text`。两个输入框都支持以下变量：

| 变量 | 含义 |
| --- | --- |
| `$query.text` | Bob 输入文本 |
| `$query.detectFromLang` | 原语言名称，如 English |
| `$query.detectToLang` | 目标语言名称，如 Simplified Chinese |

语言优先采用手动选择，否则采用 Bob 检测结果；无法检测时使用 Auto。替换只做一次，输入文本中的变量字样保持原样。未知变量保持原样，不执行 JavaScript。自定义模式不要求有效的目标语言。

例如角色设定填「你是阅读助手，使用中文回答」，用户指令填：

```text
用三句话总结以下内容，再列出关键概念：
$query.text
```

可在 Bob 中添加多个 Kimi 服务，分别保存不同模式和提示词。更新插件后原服务默认仍为翻译，需主动选择「自定义 Prompt」。截图中的提示词不会被自动设为默认值。

## 行为与配置

- 支持中英、繁体、日语、韩语等常用语种；模型对不同语言的质量可能不同。
- K2.6 的快速/深入模式分别关闭/开启思考；K3 分别使用 low/high 推理强度；K2.7 Code 始终开启思考。
- 只显示最终内容，保留模型返回的换行，不展示 `reasoning_content`。
- 每次翻译独立，不保存或发送此前翻译历史。Preserved Thinking 是多轮上下文机制，此插件无需维护历史思考内容。
- 非流式输出，完成后一次展示。HTTP 超时 170 秒，插件超时 180 秒，支持 Bob 取消信号。
- 最大输出 Token 默认 8192，可设置 256～32768。模型思考也消耗额度；截断时提示调整设置或缩短文本。
- 验证按钮只请求 `/v1/models`；成功表示密钥可访问该模型列表，不保证账户余额充足或翻译请求必定成功。
- 文本和 API Key 通过 HTTPS 直接发送至 `api.moonshot.cn`。API 使用由 Kimi 账户计费。密钥由 Bob 插件设置管理；代码不写日志、不保存译文、不回传原始响应。
- 没有自动重试，避免不明确的重复调用费用。

## 开发与打包

无需安装 npm 依赖。Node.js 18+，打包脚本使用 macOS 自带 `/usr/bin/zip`。

```sh
npm test
npm run build
```

`src/main.js` 只使用 JavaScript 内置对象和 Bob 的 `$http`、`$option`。`tests/plugin.test.cjs` 以 Node VM 模拟 Bob 环境，测试请求参数、语言、响应解析、截断、错误、取消信号透传与请求隔离。打包仅包含根目录 `info.json` 和 `main.js`。

当前 14 项模拟测试通过，ZIP 完整性检查通过。这些结果不等于真实 JavaScriptCore/Bob 运行或 Kimi 在线调用通过；最后一步是在 Bob 中填入自己的密钥并实际翻译。

交付目录不是 Git 仓库，因此未生成提交或推送。

## 参考

- [Bob 插件开发](https://bobtranslate.com/plugin/)
- [Bob 文本翻译接口](https://bobtranslate.com/plugin/quickstart/translate.html)
- [Bob 插件配置](https://bobtranslate.com/plugin/quickstart/info.html)
- [Kimi Chat Completions / Preserved Thinking](https://platform.kimi.com/docs/api/chat#preserved-thinking)
- [Kimi 模型参数](https://platform.kimi.com/docs/api/models-overview)

实现依据 2026-09-25 读取的官方文档；具体模型访问权限以账户为准。
