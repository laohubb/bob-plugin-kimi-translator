# Kimi 与 Magpie · 两个独立 Bob 插件

提供两个独立安装包和服务，各自只显示自己的参数，没有接入方式选择器。两者都支持流式翻译、原语言润色和自定义 Prompt，需要 macOS 与 Bob 1.8.0 或更新版本。

| 插件 | 安装包 | 配置 |
| --- | --- | --- |
| Kimi 翻译 | `kimi-translate-1.4.0.bobplugin` | Kimi API Key、Kimi 模型、思考模式、最大输出 Token、模式和提示词 |
| Magpie | `magpie-1.0.0.bobplugin` | 本地网关地址、网关密钥、模型 ID、推理强度、最大输出 Token、模式和提示词 |

Kimi 的源码位于 `src/`，Magpie 的源码位于 `magpie/src/`。两者使用不同的插件标识，Bob 分别保存服务配置；同名的最大输出 Token 和提示词设置也互不影响。Magpie 的说明见 [magpie/README.md](magpie/README.md)。

## 从合并版 1.3.0 更新

1. 如果旧 Kimi 服务使用的是 Magpie，先记下该服务的网关设置、模式、自定义提示词和最大输出 Token，再停用该服务。
2. 双击 `magpie-1.0.0.bobplugin`，在 Bob 的文本翻译服务中添加独立的「Magpie」，填入上述设置并验证。
3. 双击 `kimi-translate-1.4.0.bobplugin` 更新原来的 Kimi 插件。它沿用 `local.laohu.bob.kimi`，原 Kimi API Key、模型、思考模式、Token 和提示词字段标识不变，但之后只调用 Kimi 官方 API。
4. 选择并启用需要的独立服务。旧接入方式和网关字段不再显示，也不再参与 Kimi 请求。

新 Magpie 的标识为 `local.laohu.bob.magpie`，不会自动读取旧 Kimi 服务里的设置。插件脚本没有跨服务读取配置的接口，因此新服务需要重新填写自定义设置；默认网关地址为 `http://127.0.0.1:3425/v1`、模型为 `group/smart-easy`、推理强度遵循网关默认、最大输出 Token 为 8192，本机无需鉴权时网关密钥可留空。

两份安装包本地构建；本次未发布 GitHub Release，Kimi 的 `appcast.json` 保留已发布版本，Magpie 不使用 Kimi 的更新清单。

## Kimi 安装与使用

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
- Kimi 插件的文本和 API Key 通过 HTTPS 直接发送至 `api.moonshot.cn`。密钥由 Bob 插件设置管理；代码不写日志、不保存译文、不回传原始响应。
- 没有自动重试，避免不明确的重复调用费用。

## 开发与打包

无需安装 npm 依赖。Node.js 18+，打包脚本使用 macOS 自带 `/usr/bin/zip`。

```sh
npm test
npm run build
```

`src/main.js` 只使用 JavaScript 内置对象和 Bob 的 `$http`、`$option`。`tests/plugin.test.cjs` 以 Node VM 模拟 Bob 环境，测试请求参数、语言、SSE 跨分片解析、累计流式回调、截断、错误、取消信号透传与请求隔离。构建分别生成两个安装包，每个包只包含自己的根目录 `info.json` 和 `main.js`。

当前模拟测试与 ZIP 完整性检查应在每次构建后重新执行。这些结果不等于真实 JavaScriptCore/Bob 运行通过；Kimi 需要填入自己的密钥实际调用，Magpie 需要在本机网关运行时实际调用。

源码由 Git 管理；安装包生成在仓库上一级目录，不进入提交。

2026-10-14 验证：26 项 Node VM 测试通过，两份安装包 ZIP 完整性检查通过。独立 Magpie 插件通过 Node HTTP 适配器真实调用本地 `group/smart-easy`，模型验证成功，收到 4 次流式输出，`Hello, world.` 完整翻译为「你好，世界。」。本次未在 Bob 内安装两个新版插件或验证配置界面，也未调用 Kimi 官方 API。

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
