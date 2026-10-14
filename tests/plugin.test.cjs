const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
const info = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/info.json'), 'utf8'));
const magpieCode = fs.readFileSync(path.join(__dirname, '../magpie/src/main.js'), 'utf8');
const magpieInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../magpie/src/info.json'), 'utf8'));
function harness(options = {}, plugin = 'kimi') {
  const requests = [], replies = [], streams = [];
  const manifest = plugin === 'magpie' ? magpieInfo : info;
  const defaults = Object.fromEntries(manifest.options.map(o => [o.identifier, o.defaultValue || '']));
  const context = vm.createContext({ $option: { ...defaults, apiKey: 'test-key', ...options },
    $http: {
      request: request => requests.push(request),
      streamRequest: request => requests.push(request)
    } });
  vm.runInContext(plugin === 'magpie' ? magpieCode : code, context);
  const query = { text: 'Hello\n\nWorld', from: 'auto', to: 'auto', detectFrom: 'en', detectTo: 'zh-Hans',
    cancelSignal: {}, onStream: value => streams.push(value), onCompletion: value => replies.push(value) };
  return { context, requests, replies, streams, query, run() { context.translate(query); } };
}
function gatewayHarness(options = {}) { return harness(options, 'magpie'); }
function event(content, reason = null) {
  return `data: ${JSON.stringify({ choices: [{ delta: content === undefined ? {} : { content }, finish_reason: reason }] })}\n\n`;
}
function finish(request, content = '你好\n\n世界', reason = 'stop', includeDone = true) {
  request.streamHandler({ text: event(content) + event(undefined, reason) + (includeDone ? 'data: [DONE]\n\n' : '') });
  request.handler({ response: { statusCode: 200 } });
}
test('Bob manifest and runtime entry points', () => {
  assert.match(info.identifier, /^[a-z0-9.]+$/);
  assert.equal(info.category, 'translate');
  const h = harness();
  for (const name of ['translate', 'pluginValidate', 'supportLanguages', 'pluginTimeoutInterval']) {
    assert.equal(typeof h.context[name], 'function');
  }
  assert.ok(h.context.supportLanguages().includes('zh-Hant'));
});
test('default request, cancellation, paragraph fidelity and exactly one completion', () => {
  const h = harness(); h.run();
  const r = h.requests[0];
  assert.equal(r.url, 'https://api.moonshot.cn/v1/chat/completions');
  assert.equal(r.header.Authorization, 'Bearer test-key');
  assert.equal(r.body.thinking.type, 'disabled');
  assert.equal(r.body.stream, true);
  assert.equal(r.body.max_tokens, 8192);
  assert.equal(r.cancelSignal, h.query.cancelSignal);
  assert.equal(r.body.messages[1].content, h.query.text);
  assert.match(r.body.messages[0].content, /Simplified Chinese/);
  const payload = event('你好') + event('\n\n世界') + event(undefined, 'stop') + 'data: [DONE]\n\n';
  for (const part of [payload.slice(0, 9), payload.slice(9, 47), payload.slice(47)]) {
    r.streamHandler({ text: part });
  }
  r.handler({ response: { statusCode: 200 } });
  r.handler({ response: { statusCode: 200 } });
  r.streamHandler({ text: event('duplicate') });
  assert.equal(h.replies.length, 1);
  assert.deepEqual(h.streams.map(value => value.result.content.text), ['你好', '你好\n\n世界']);
  assert.equal(h.streams[1].result.toParagraphs[0], '你好\n\n世界');
  assert.equal(h.replies[0].result.toParagraphs[0], '你好\n\n世界');
  assert.equal(h.replies[0].result.content.text, '你好\n\n世界');
  assert.equal(h.replies[0].result.raw, undefined);
});
test('explicit languages override detection', () => {
  const h = harness(); h.query.from = 'fr'; h.query.to = 'zh-Hant'; h.run();
  assert.match(h.requests[0].body.messages[0].content, /French into Traditional Chinese/);
});
test('model-specific parameters do not conflict', () => {
  for (const thinking of ['enabled', 'disabled']) {
    const h = harness({ model: 'kimi-k3', thinking }); h.run();
    assert.equal(h.requests[0].body.reasoning_effort, thinking === 'enabled' ? 'high' : 'low');
    assert.equal(h.requests[0].body.max_completion_tokens, 8192);
    assert.equal(h.requests[0].body.max_tokens, undefined);
    assert.equal(h.requests[0].body.thinking, undefined);
  }
  const h = harness({ model: 'kimi-k2.7-code' }); h.run();
  assert.equal(h.requests[0].body.thinking.keep, 'all');
  assert.equal(h.requests[0].body.thinking.type, 'enabled');
});
test('invalid config and text never send a request', () => {
  for (const options of [{ apiKey: '' }, { apiKey: 'bad\nkey' }, { maxTokens: '1' },
    { maxTokens: '8192abc' }, { maxTokens: '999999' }, { model: 'invalid' }]) {
    const h = harness(options); h.run(); assert.equal(h.requests.length, 0); assert.ok(h.replies[0].error);
  }
  const h = harness(); h.query.text = '  '; h.run(); assert.equal(h.requests.length, 0);
  const u = harness(); u.query.detectTo = 'unsupported'; u.run();
  assert.equal(u.replies[0].error.type, 'unsupportedLanguage');
});
test('HTTP and network errors omit sensitive response details', () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const h = harness(); h.run();
    h.requests[0].handler({ response: { statusCode: status }, error: {} });
    assert.ok(h.replies[0].error); assert.ok(!JSON.stringify(h.replies[0]).includes('test-key'));
  }
  const h = harness(); h.run(); h.requests[0].handler({ error: { message: 'cancelled' } });
  assert.equal(h.replies[0].error.type, 'network');
});
test('cancelled requests stop emitting streamed content', () => {
  const h = harness(); h.run(); const r = h.requests[0];
  r.streamHandler({ text: event('partial') });
  r.handler({ error: { message: 'cancelled' } });
  r.streamHandler({ text: event('ignored') });
  assert.deepEqual(h.streams.map(value => value.result.content.text), ['partial']);
  assert.equal(h.replies.length, 1);
  assert.equal(h.replies[0].error.type, 'network');
});
test('truncated, empty, malformed and refused responses cannot become translations', () => {
  for (const scenario of [
    r => finish(r, 'partial', 'length'),
    r => finish(r, '', 'stop'),
    r => finish(r, 'x', 'content_filter'),
    r => { r.streamHandler({ text: 'data: <html>error</html>\n\n' }); r.handler({ response: { statusCode: 200 } }); },
    r => { r.streamHandler({ text: event('x') + event(undefined, 'stop') }); r.handler({ response: { statusCode: 200 } }); }
  ]) {
    const h = harness(); h.run(); scenario(h.requests[0]); assert.ok(h.replies[0].error);
  }
});
test('requests are isolated and legacy completion works', () => {
  const h = harness(); h.run(); finish(h.requests[0]);
  h.query.text = 'Second'; h.run(); assert.equal(h.requests[1].body.messages.length, 2);
  assert.ok(!JSON.stringify(h.requests[1].body).includes('Hello'));
  delete h.query.onCompletion;
  h.context.translate(h.query, value => h.replies.push(value));
  finish(h.requests[2]); assert.equal(h.replies.length, 2);
});
test('validation checks available model without a translation call', () => {
  for (const available of [true, false]) {
    const h = harness(); h.context.pluginValidate(v => h.replies.push(v));
    assert.equal(h.requests[0].method, 'GET');
    h.requests[0].handler({ response: { statusCode: 200 }, data: { data: available ? [{ id: 'kimi-k2.6' }] : [] } });
    assert.equal(h.replies[0].result, available);
  }
});

test('custom prompts fully replace translation rules and substitute variables', () => {
  const h = harness({ mode: 'custom', systemPrompt: 'Analyze $query.detectFromLang text for $query.detectToLang readers.', userPrompt: 'Summarize:\n$query.text\n$query.text' });
  h.query.text = 'literal $query.detectToLang and $&'; h.run();
  const messages = h.requests[0].body.messages;
  assert.equal(messages[0].content, 'Analyze English text for Simplified Chinese readers.');
  assert.equal(messages[1].content, 'Summarize:\nliteral $query.detectToLang and $&\nliteral $query.detectToLang and $&');
  assert.equal(messages.length, 2);
  finish(h.requests[0], 'A summary');
  assert.equal(h.replies[0].result.to, undefined);
});
test('custom mode has no implicit system prompt and works without target language', () => {
  const h = harness({ mode: 'custom', systemPrompt: '', userPrompt: '' });
  delete h.query.detectTo; h.run();
  assert.equal(h.requests[0].body.messages.length, 1);
  assert.equal(h.requests[0].body.messages[0].role, 'user');
  assert.equal(h.requests[0].body.messages[0].content, h.query.text);
});
test('custom variables honor explicit languages and unknown variables stay literal', () => {
  const h = harness({ mode: 'custom', userPrompt: '$query.detectFromLang → $query.detectToLang $query.unknown $query.textExtra' });
  h.query.from = 'ja'; h.query.to = 'fr'; h.run();
  assert.equal(h.requests[0].body.messages[0].content, 'Japanese → French $query.unknown $query.textExtra');
});
test('polish preserves language and ignores custom settings', () => {
  const h = harness({ mode: 'polish', systemPrompt: 'UNUSED', userPrompt: 'UNUSED' }); h.run();
  const messages = h.requests[0].body.messages;
  assert.match(messages[0].content, /Do not translate/);
  assert.equal(messages[1].content, h.query.text);
  assert.ok(!JSON.stringify(messages).includes('UNUSED'));
  finish(h.requests[0], 'Polished text');
  assert.equal(h.replies[0].result.to, 'en');
});
test('translation ignores custom settings; invalid mode and blank rendered user prompt fail', () => {
  const h = harness({ systemPrompt: 'UNUSED', userPrompt: 'UNUSED' }); h.run();
  assert.match(h.requests[0].body.messages[0].content, /professional translator/);
  for (const options of [{ mode: 'invalid' }, { mode: 'custom', userPrompt: '   ' }]) {
    const h = harness(options); h.run(); assert.equal(h.requests.length, 0); assert.equal(h.replies[0].error.type, 'param');
  }
});

test('Bob stream envelope displays cumulative text before HTTP completion', () => {
  const h = harness();
  const displayed = [];
  h.query.onStream = frame => {
    assert.ok(frame.result, 'Bob requires the result envelope');
    displayed.push(frame.result.toParagraphs.join('\n\n'));
  };
  h.run();
  const r = h.requests[0];
  r.streamHandler({ text: event('第一段') });
  assert.deepEqual(displayed, ['第一段']);
  assert.equal(h.replies.length, 0);
  r.streamHandler({ text: event('\n第二段') });
  assert.deepEqual(displayed, ['第一段', '第一段\n第二段']);
  assert.equal(h.replies.length, 0);
  r.streamHandler({ text: event(undefined, 'stop') + 'data: [DONE]\n\n' });
  r.handler({ response: { statusCode: 200 } });
  assert.equal(h.replies.length, 1);
  assert.equal(h.replies[0].result.toParagraphs[0], displayed[1]);
});

test('Magpie defaults use loopback, a routing group and no Kimi key or thinking parameters', () => {
  const h = gatewayHarness({ apiKey: 'kimi-key-must-not-leak', thinking: 'enabled' });
  h.run();
  const r = h.requests[0];
  assert.equal(r.url, 'http://127.0.0.1:3425/v1/chat/completions');
  assert.equal(r.header.Authorization, undefined);
  assert.equal(r.body.model, 'group/smart-easy');
  assert.equal(r.body.max_tokens, 8192);
  assert.equal(r.body.thinking, undefined);
  assert.equal(r.body.reasoning_effort, undefined);
  assert.ok(!JSON.stringify(r).includes('kimi-key-must-not-leak'));
  finish(r);
  assert.equal(h.replies[0].result.content.text, '你好\n\n世界');
});

test('Magpie supports optional gateway authentication, custom models and explicit effort', () => {
  const h = gatewayHarness({ apiKey: '', gatewayKey: 'gateway-test-key',
    gatewayModel: 'codex/gpt-6-astra', gatewayEffort: 'low', gatewayUrl: 'http://localhost:3425/' });
  h.run();
  const r = h.requests[0];
  assert.equal(r.url, 'http://localhost:3425/v1/chat/completions');
  assert.equal(r.header.Authorization, 'Bearer gateway-test-key');
  assert.equal(r.body.model, 'codex/gpt-6-astra');
  assert.equal(r.body.reasoning_effort, 'low');
  assert.equal(r.body.thinking, undefined);
});

test('Magpie normalizes local addresses and rejects malformed or external destinations', () => {
  for (const url of ['http://127.0.0.1:3425', 'http://127.0.0.1:3425/v1/', 'http://127.0.0.1:3425/V1']) {
    const h = gatewayHarness({ gatewayUrl: url }); h.run();
    assert.equal(h.requests[0].url, 'http://127.0.0.1:3425/v1/chat/completions');
  }
  const v6 = gatewayHarness({ gatewayUrl: 'http://[::1]:3425/v1' }); v6.run();
  assert.equal(v6.requests[0].url, 'http://[::1]:3425/v1/chat/completions');
  for (const options of [
    { gatewayUrl: 'https://example.com/v1' }, { gatewayUrl: 'http://localhost.evil/v1' },
    { gatewayUrl: 'http://key@localhost:3425/v1' }, { gatewayUrl: 'http://localhost:3425/v1?key=x' },
    { gatewayUrl: 'http://localhost:3425/v1/chat/completions' },
    { gatewayKey: 'bad\nkey' }, { gatewayModel: 'bad model' }, { gatewayEffort: 'invalid' }
  ]) {
    const h = gatewayHarness({ ...options }); h.run();
    assert.equal(h.requests.length, 0);
    assert.ok(h.replies[0].error);
  }
});

test('Magpie validation uses its own URL, key and model list', () => {
  for (const available of [true, false]) {
    const h = gatewayHarness({ apiKey: '', gatewayModel: 'group/smart-split' });
    h.context.pluginValidate(v => h.replies.push(v));
    const r = h.requests[0];
    assert.equal(r.url, 'http://127.0.0.1:3425/v1/models');
    assert.equal(r.header.Authorization, undefined);
    r.handler({ response: { statusCode: 200 }, data: JSON.stringify({ data: available ? [{ id: 'group/smart-split' }] : [] }) });
    assert.equal(h.replies[0].result, available);
  }
});

test('Magpie errors identify the gateway without exposing response bodies or credentials', () => {
  for (const status of [401, 403, 429, 502]) {
    const h = gatewayHarness({ gatewayKey: 'gateway-test-key' }); h.run();
    h.requests[0].handler({ response: { statusCode: status }, data: 'gateway-test-key sensitive-text' });
    const reply = JSON.stringify(h.replies[0]);
    assert.match(reply, /Magpie/);
    assert.ok(!reply.includes('gateway-test-key'));
    assert.ok(!reply.includes('sensitive-text'));
  }
});

test('Magpie preserves custom and polish modes and treats truncation as failure', () => {
  const custom = gatewayHarness({ mode: 'custom', systemPrompt: 'Summarize', userPrompt: '$query.text' });
  custom.run();
  assert.equal(custom.requests[0].body.messages[0].content, 'Summarize');
  finish(custom.requests[0], 'Summary');
  assert.equal(custom.replies[0].result.to, undefined);
  const polish = gatewayHarness({ mode: 'polish' }); polish.run();
  assert.match(polish.requests[0].body.messages[0].content, /Do not translate/);
  finish(polish.requests[0], 'partial', 'length');
  assert.ok(polish.replies[0].error);
});

test('independent plugin identities expose only their own provider settings', () => {
  assert.equal(info.identifier, 'local.laohu.bob.kimi');
  assert.equal(magpieInfo.identifier, 'local.laohu.bob.magpie');
  assert.notEqual(info.identifier, magpieInfo.identifier);
  assert.deepEqual(info.options.map(o => o.identifier),
    ['apiKey', 'model', 'thinking', 'maxTokens', 'mode', 'systemPrompt', 'userPrompt']);
  assert.deepEqual(magpieInfo.options.map(o => o.identifier),
    ['gatewayUrl', 'gatewayKey', 'gatewayModel', 'gatewayEffort', 'maxTokens', 'mode', 'systemPrompt', 'userPrompt']);
  assert.equal(magpieInfo.appcast, undefined, 'Magpie must not use the Kimi update feed');
});

test('leftover settings cannot switch either standalone plugin to the other provider', () => {
  const kimi = harness({ provider: 'magpie', gatewayModel: 'group/smart-split', gatewayKey: 'ignored-gateway-key' });
  kimi.run();
  assert.equal(kimi.requests[0].url, 'https://api.moonshot.cn/v1/chat/completions');
  assert.equal(kimi.requests[0].body.model, 'kimi-k2.6');
  assert.ok(!JSON.stringify(kimi.requests[0]).includes('ignored-gateway-key'));
  const magpie = gatewayHarness({ provider: 'kimi', apiKey: 'ignored-kimi-key', model: 'kimi-k3', thinking: 'enabled' });
  magpie.run();
  assert.equal(magpie.requests[0].body.model, 'group/smart-easy');
  assert.equal(magpie.requests[0].body.thinking, undefined);
  assert.ok(!JSON.stringify(magpie.requests[0]).includes('ignored-kimi-key'));
});

test('each plugin has its own token limit and ignores invalid settings belonging to the other plugin', () => {
  const kimi = harness({ maxTokens: '1024', gatewayEffort: 'invalid', gatewayUrl: 'invalid' });
  const magpie = gatewayHarness({ maxTokens: '2048', model: 'invalid', apiKey: 'bad\nkey' });
  kimi.run(); magpie.run();
  assert.equal(kimi.requests[0].body.max_tokens, 1024);
  assert.equal(magpie.requests[0].body.max_tokens, 2048);
  for (const maxTokens of ['1', '32769', '8192abc']) {
    const h = gatewayHarness({ maxTokens }); h.run();
    assert.equal(h.requests.length, 0);
    assert.equal(h.replies[0].error.type, 'param');
  }
});

test('Magpie preserves split SSE chunks, cancellation and one completion per request', () => {
  const h = gatewayHarness(); h.run();
  const r = h.requests[0];
  assert.equal(r.cancelSignal, h.query.cancelSignal);
  const payload = event('你好') + event('\n\n世界') + event(undefined, 'stop') + 'data: [DONE]\n\n';
  for (const chunk of [payload.slice(0, 9), payload.slice(9, 47), payload.slice(47)]) {
    r.streamHandler({ text: chunk });
  }
  r.handler({ response: { statusCode: 200 } });
  r.handler({ response: { statusCode: 200 } });
  r.streamHandler({ text: event('ignored') });
  assert.equal(h.replies.length, 1);
  assert.deepEqual(h.streams.map(frame => frame.result.content.text), ['你好', '你好\n\n世界']);
  h.query.text = 'Second'; h.run();
  assert.ok(!JSON.stringify(h.requests[1].body).includes('Hello'));
  h.requests[1].handler({ error: { message: 'cancelled' } });
  h.requests[1].streamHandler({ text: event('ignored') });
  assert.equal(h.replies[1].error.type, 'network');
  assert.equal(h.streams.length, 2);
});
