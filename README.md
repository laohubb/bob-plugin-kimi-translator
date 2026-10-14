# Kimi 翻译 · Bob 插件

使用 Kimi API 或本地 Magpie 网关在 Bob 中流式翻译、润色和执行自定义提示词。支持独立设置 System Prompt 和 User Prompt。

[下载最新安装包](https://github.com/laohubb/bob-plugin-kimi-translator/releases/latest) · [反馈问题](https://github.com/laohubb/bob-plugin-kimi-translator/issues)

需要 macOS、Bob 1.8.0 或更新版本。Kimi 官方模式需要自己的 Kimi API Key；Magpie 模式使用本机网关及其已配置的模型。调用费用或订阅额度由所选上游服务决定。

## 本地 Magpie 接入（1.3.0）

双击 `kimi-translate-1.3.0.bobplugin` 更新原插件，再在 Bob 的「Kimi 翻译」服务设置中配置：

| 设置 | 值 |
| --- | --- |
| 接入方式 | 本地 Magpie 网关 |
| Magpie 网关地址 | `http://127.0.0.1:3425/v1` |
| Magpie 网关密钥 | 本机无需鉴权时留空；需要鉴权时填写网关密钥 |
| Magpie 模型 ID | 默认 `group/smart-easy`，也可填 `group/smart-split` 或模型列表中的完整 ID |
| Magpie 推理强度 | 默认遵循网关／模型配置；按支持情况可指定 low、medium、high |

保持 Magpie 运行，点击验证检查连接及模型，再进行翻译或自定义处理。地址支持本机 `127.0.0.1`、`localhost`、`[::1]` 及自定义端口，可省略 `/v1`，不接受远程地址。

Magpie 模式不使用「Kimi API Key」「模型」「思考模式」这三个 Kimi 专属设置，也不发送 Kimi 的 `thinking` 参数。请求使用 `/v1/chat/completions` SSE、`max_tokens` 和可选的 `reasoning_effort`，具体上游由 Magpie 转发。输入文本与提示词先发送给本机网关，再由网关发往所选上游；插件不会把密钥写入代码或安装包。

为保留已有配置，升级后接入方式默认仍是 Kimi 官方 API，需主动切换到 Magpie。插件标识及已有提示词、模式和 Kimi 设置保持兼容。1.3.0 安装包本地构建，现有 `appcast.json` 仍指向已发布的 1.2.2；本次不发布 GitHub Release。

2026-10-14 验证：22 项 Node VM 测试通过，安装包 ZIP 完整性检查通过。通过 Node HTTP 适配器运行插件的 `pluginValidate` 与 `translate`，真实请求本地 Magpie 的 `group/smart-easy`，收到 4 次累计流式输出，`Hello, world.` 完整翻译为「你好，世界。」。本机 Bob 版本为 1.21.1，尚未在 Bob 内安装 1.3.0 或验证实际界面显示；真实网关调用不等于 Bob 宿主验收。

## 安装与使用

1. 双击安装包，在 Bob 中完成安装。
2. 在 Bob「设置 / 偏好设置 → 服务 → 文本翻译」添加「Kimi 翻译」。
3. 在 [Kimi 开放平台](https://platform.kimi.com/) 创建 API Key，填入插件的安全输入框。无需把密钥发给开发者。
4. 默认选择 Kimi K2.6、快速响应，点击验证以检查密钥和模型是否可用。
5. 启用此服务，使用 Bob 划词、截图识别后的文本或输入翻译。源语言与目标语言由 Bob 的选择和检测结果决定。

插件最低要求 Bob 1.8.0；同时提供 `toParagraphs` 与新版结果格式。自动化测试使用模拟环境，尚未完成 Bob 内实际翻译和真实 API 调用验收。

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

可在 Bob 中添加多个 Kimi 服务，分别保存不同模式和提示词。更新插件后原服务默认仍为翻译，需主动选择「自定义 Prompt」。

## 行为与配置

- 支持中英、繁体、日语、韩语等常用语种；模型对不同语言的质量可能不同。
- K2.6 的快速/深入模式分别关闭/开启思考；K3 分别使用 low/high 推理强度；K2.7 Code 始终开启思考。
- 只显示最终内容，保留模型返回的换行，不展示 `reasoning_content`。
- 每次翻译独立，不保存或发送此前翻译历史。Preserved Thinking 是多轮上下文机制，此插件无需维护历史思考内容。
- 使用 Kimi Chat Completions SSE 流式输出，Bob 会随着内容生成持续更新结果；最终完整结果仍通过完成回调提交。HTTP 超时 170 秒，插件超时 180 秒，支持 Bob 取消信号。
- 最大输出 Token 默认 8192，可设置 256～32768。模型思考也消耗额度；截断时提示调整设置或缩短文本。
- 验证按钮只请求 `/v1/models`；成功表示密钥可访问该模型列表，不保证账户余额充足或翻译请求必定成功。
- Kimi 官方模式的文本和 API Key 通过 HTTPS 直接发送至 `api.moonshot.cn`。Magpie 模式发送至所配置的本机网关，再由网关转发至上游。密钥由 Bob 插件设置管理；代码不写日志、不保存译文、不回传原始响应。
- 没有自动重试，避免不明确的重复调用费用。

## 开发与打包

无需安装 npm 依赖。Node.js 18+，打包脚本使用 macOS 自带 `/usr/bin/zip`。

```sh
npm test
npm run build
```

`src/main.js` 只使用 JavaScript 内置对象和 Bob 的 `$http`、`$option`。`tests/plugin.test.cjs` 以 Node VM 模拟 Bob 环境，测试请求参数、语言、SSE 跨分片解析、累计流式回调、截断、错误、取消信号透传与请求隔离。打包仅包含根目录 `info.json` 和 `main.js`。

当前模拟测试与 ZIP 完整性检查应在每次构建后重新执行。这些结果不等于真实 JavaScriptCore/Bob 运行或 Kimi 在线调用通过；最后一步是在 Bob 中填入自己的密钥并实际翻译。

源码由 Git 管理；安装包生成在仓库上一级目录，不进入提交。

## 参考

- [Bob 插件开发](https://bobtranslate.com/plugin/)
- [Bob 文本翻译接口](https://bobtranslate.com/plugin/quickstart/translate.html)
- [Bob 流式 HTTP 接口](https://bobtranslate.com/plugin/api/http.html#http-streamrequest-object-bob-1-8-0-%E5%8F%AF%E7%94%A8)
- [Bob 插件配置](https://bobtranslate.com/plugin/quickstart/info.html)
- [Kimi Chat Completions / 流式响应](https://platform.kimi.com/docs/api/chat#streaming)
- [Kimi 模型参数](https://platform.kimi.com/docs/api/models-overview)

实现依据 2026-09-26 读取的官方文档；具体模型访问权限以账户为准。

## 1.2.1 流式回调修复

修复 `query.onStream` 缺少 `{ result: ... }` 外层对象的问题，累计译文放在 `result.toParagraphs` 和 `result.content` 中。对照 [OpenAI Translator 的流式实现](https://github.com/nextai-translator/bob-plugin-openai-translator/blob/main/src/utils/sse.ts) 核验回调结构。新增回归测试，确认 HTTP 完成之前已逐次回传累计译文。安装时请确认 Bob 显示版本为 1.2.1；模拟测试不代替 Bob 内实际显示验收。

## 1.2.2 公开发布准备

补充 GitHub 下载入口和 Bob 自动更新地址，保留原插件标识及已有设置。安装包只包含插件代码和配置定义，不包含 API Key。

## 发布维护

发布前运行 `npm test` 和 `npm run build`，检查安装包 ZIP 完整性，并将其 SHA256、版本、下载链接和发布时间写入根目录 `appcast.json`。Release 附件必须使用计算 SHA256 时的同一份安装包。仓库设置 `bobplugin` topic 后，第三方列表会定期抓取；发布成功不代表已经收录。
