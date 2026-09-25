const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
const info = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/info.json'), 'utf8'));
function harness(options = {}) {
  const requests = [], replies = [];
  const defaults = Object.fromEntries(info.options.map(o => [o.identifier, o.defaultValue || '']));
  const context = vm.createContext({ $option: { ...defaults, apiKey: 'test-key', ...options },
    $http: { request: request => requests.push(request) } });
  vm.runInContext(code, context);
  const query = { text: 'Hello\n\nWorld', from: 'auto', to: 'auto', detectFrom: 'en', detectTo: 'zh-Hans',
    cancelSignal: {}, onCompletion: value => replies.push(value) };
  return { context, requests, replies, query, run() { context.translate(query); } };
}
function response(content = '你好\n\n世界', reason = 'stop') {
  return { response: { statusCode: 200 }, data: { choices: [{ finish_reason: reason,
    message: { content, reasoning_content: 'not translation' } }] } };
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
  assert.equal(r.body.max_tokens, 8192);
  assert.equal(r.cancelSignal, h.query.cancelSignal);
  assert.equal(r.body.messages[1].content, h.query.text);
  assert.match(r.body.messages[0].content, /Simplified Chinese/);
  r.handler(response()); r.handler(response('duplicate'));
  assert.equal(h.replies.length, 1);
  assert.equal(h.replies[0].result.toParagraphs[0], '你好\n\n世界');
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
    h.requests[0].handler({ response: { statusCode: status }, error: {}, data: 'test-key' });
    assert.ok(h.replies[0].error); assert.ok(!JSON.stringify(h.replies[0]).includes('test-key'));
  }
  const h = harness(); h.run(); h.requests[0].handler({ error: { message: 'cancelled' } });
  assert.equal(h.replies[0].error.type, 'network');
});
test('truncated, empty, malformed and refused responses cannot become translations', () => {
  for (const resp of [response('partial', 'length'), response(''), response('x', 'content_filter'),
    { response: { statusCode: 200 }, data: '<html>error</html>' },
    { response: { statusCode: 200 }, data: {} }]) {
    const h = harness(); h.run(); h.requests[0].handler(resp); assert.ok(h.replies[0].error);
  }
  const h = harness(); h.run(); const r = response(); r.data = JSON.stringify(r.data);
  h.requests[0].handler(r); assert.ok(h.replies[0].result);
});
test('requests are isolated and legacy completion works', () => {
  const h = harness(); h.run(); h.requests[0].handler(response());
  h.query.text = 'Second'; h.run(); assert.equal(h.requests[1].body.messages.length, 2);
  assert.ok(!JSON.stringify(h.requests[1].body).includes('Hello'));
  delete h.query.onCompletion;
  h.context.translate(h.query, value => h.replies.push(value));
  h.requests[2].handler(response()); assert.equal(h.replies.length, 2);
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
  h.requests[0].handler(response('A summary'));
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
  h.requests[0].handler(response('Polished text'));
  assert.equal(h.replies[0].result.to, 'en');
});
test('translation ignores custom settings; invalid mode and blank rendered user prompt fail', () => {
  const h = harness({ systemPrompt: 'UNUSED', userPrompt: 'UNUSED' }); h.run();
  assert.match(h.requests[0].body.messages[0].content, /professional translator/);
  for (const options of [{ mode: 'invalid' }, { mode: 'custom', userPrompt: '   ' }]) {
    const h = harness(options); h.run(); assert.equal(h.requests.length, 0); assert.equal(h.replies[0].error.type, 'param');
  }
});
