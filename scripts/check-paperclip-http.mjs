// Invoked by check-paperclip.py against its disposable server and browser.
const [cdpOrigin, origin] = process.argv.slice(2);
const tab = await fetch(`${cdpOrigin}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(String(event.data));
  if (message.id) pending.get(message.id)?.(message);
  else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
  pending.set(id, message => {
    clearTimeout(timer); pending.delete(id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
try {
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.nativeUuidType = typeof crypto.randomUUID;',
  });
  await cdp('Page.navigate', { url: origin });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("#root")?.textContent?.length > 30 && document.querySelector("button, a[href]"))')) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  if (!ready) throw new Error(`UI did not render: ${await evaluate('document.body.innerText')}`);
  const result = await evaluate('({ secure: isSecureContext, native: window.nativeUuidType, uuid: crypto.randomUUID() })');
  if (result.secure || result.native !== 'undefined') throw new Error('Test did not reproduce insecure HTTP');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result.uuid)) throw new Error('Invalid UUID');
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log('PASS: UI renders on insecure HTTP with working UUIDs and no browser exceptions');
} finally {
  ws.close();
}
