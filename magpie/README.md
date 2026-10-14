# Magpie · Bob 插件

独立接入本机 Magpie 网关，支持流式翻译、原语言润色和自定义 Prompt。插件标识为 `local.laohu.bob.magpie`，与 Kimi 插件的服务配置分别保存。

## 安装与设置

双击 `magpie-1.0.0.bobplugin`，在 Bob 的文本翻译服务中添加「Magpie」：

| 设置 | 默认值或说明 |
| --- | --- |
| 网关地址 | `http://127.0.0.1:3425/v1`，支持本机 localhost、127.0.0.1、[::1] 及自定义端口 |
| 网关密钥 | 本机无需鉴权时留空；需要鉴权时使用网关密钥 |
| 模型 ID | `group/smart-easy`，可改为 `/v1/models` 中的完整 ID |
| 推理强度 | 默认不发送，由网关配置决定；可选择 low、medium、high |
| 最大输出 Token | 8192，范围 256～32768 |
| 模式 | 翻译、润色或自定义 Prompt |
| System Prompt | 仅自定义模式使用，可留空 |
| User Prompt | 仅自定义模式使用，默认 `$query.text` |

保持 Magpie 运行，点击验证后使用。验证只检查模型列表与所选 ID，不代表生成请求必定成功。模型计费或订阅额度由网关所选上游决定。

两个提示词框支持 `$query.text`、`$query.detectFromLang`、`$query.detectToLang`。语言变量是英文语言名称，优先采用手动选择；变量只替换一次，不执行输入内容。自定义模式不会附加翻译指令，也不要求目标语言。

## 从合并版迁移

新插件不会自动读取原 Kimi 服务中的设置。先记录旧服务的网关参数、最大输出 Token、模式和提示词，停用旧的 Magpie 服务，再在独立 Magpie 服务里重新填写。网关字段名称与合并版一致，但由于插件标识不同，Bob 不会自动共享值。

## 请求与隐私

- 只向配置的本机地址发送请求，再由 Magpie 转发给上游。
- 使用 `/v1/chat/completions` SSE、`max_tokens` 和可选 `reasoning_effort`，不发送 Kimi 专属 `thinking` 参数。
- 每次请求独立，不发送历史文本。HTTP 超时 170 秒，插件超时 180 秒，透传 Bob 的取消信号。
- 截断、未完整结束和空内容显示错误；没有自动重试。
- 密钥通过 Bob 安全配置输入；不在代码或安装包中保存密钥、原文或输出，不返回原始服务器错误内容。

## 开发

在仓库根目录运行 `npm test` 和 `npm run build`，会同时测试并打包 Kimi 与 Magpie。Magpie 生产源文件位于 `magpie/src/`，安装包只包含 `info.json` 与 `main.js`。

Node VM 模拟测试与 Node HTTP 适配器的真实网关调用不等于 Bob 宿主运行验收。Magpie 不使用 Kimi 的自动更新地址。
