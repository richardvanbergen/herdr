// Browser regression for Ready, discussion and human/agent handoff.
// Requires a running isolated Charon server (seeded columns, no jobs) and
// Chromium with remote debugging enabled. Creates and removes synthetic jobs.
// CHARON_WORKFLOW_TEST_ORIGIN=http://127.0.0.1:7001 \
// CHARON_WORKFLOW_TEST_CDP=http://127.0.0.1:9233 bun scripts/check-board-drag.mjs
const origin = process.env.CHARON_WORKFLOW_TEST_ORIGIN;
const cdpOrigin = process.env.CHARON_WORKFLOW_TEST_CDP;
if (!origin || !cdpOrigin)
	throw new Error(
		"Set CHARON_WORKFLOW_TEST_ORIGIN and CHARON_WORKFLOW_TEST_CDP for an isolated test environment",
	);
const info = await fetch(
	`${cdpOrigin}/json/new?${encodeURIComponent(origin + "/")}`,
	{ method: "PUT" },
).then((r) => r.json());
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	ws.onopen = () => resolve();
	ws.onerror = reject;
});
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (e) => {
	const m = JSON.parse(String(e.data));
	if (m.id) {
		pending.get(m.id)?.(m);
		pending.delete(m.id);
	} else if (m.method === "Runtime.exceptionThrown") errors.push(m.params);
};
const cdp = (method, params = {}) =>
	new Promise((resolve, reject) => {
		const key = ++id;
		const timeout = setTimeout(() => {
			pending.delete(key);
			reject(new Error(`CDP timed out: ${method}`));
		}, 20000);
		pending.set(key, (message) => {
			clearTimeout(timeout);
			if (message.error) reject(new Error(JSON.stringify(message.error)));
			else resolve(message);
		});
		ws.send(JSON.stringify({ id: key, method, params }));
	});
const evaluate = async (expression) => {
	const m = await cdp("Runtime.evaluate", {
		expression,
		returnByValue: true,
		awaitPromise: true,
	});
	if (m.result.exceptionDetails)
		throw new Error(JSON.stringify(m.result.exceptionDetails));
	return m.result.result.value;
};
const wait = async (expression) => {
	const until = Date.now() + 120000;
	while (!(await evaluate(`Boolean(${expression})`))) {
		if (Date.now() > until) throw new Error("Timed out: " + expression);
		await Bun.sleep(500);
	}
};
await cdp("Runtime.enable");
await cdp("Page.enable");

const api = async (name, input = {}) => {
 const response = await fetch(`${origin}/api/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
 const result = await response.json();
 if (!response.ok) throw new Error(JSON.stringify(result));
 return result;
};
const board = await api('board/get');
const columnId = board.columns[0].id;
const job = await api('board/addJob', { columnId, title: 'Workflow browser test' });
try {
 await cdp('Page.navigate', { url: `${origin}/column/${columnId}/job/${job.id}` });
 await wait('document.querySelector("button[role=switch]")');
 await Bun.sleep(1500);
 await wait('document.querySelector("button[role=switch]")');
 await evaluate('document.querySelector("button[role=switch]").click()');
 await wait('document.querySelector("button[role=switch]").getAttribute("aria-checked") === "true"');
 const lease = await api('workflow/agent', { action: 'claim', input: { jobId: job.id } });
 await api('workflow/agent', { action: 'finish', input: { jobId: job.id, token: lease.token, status: 'blocked', content: 'What poem style?', requestId: crypto.randomUUID() } });
 await wait('document.body.innerText.includes("What poem style?")');
 await evaluate(`(() => { const input = document.querySelector('textarea[aria-label="Reply to Hermes"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Epic, including Hephaestus.'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Reply').click()`);
 await wait('document.body.innerText.includes("Epic, including Hephaestus.") && document.body.innerText.includes("Agent queued")');
 const result = await api('workflow/get', { jobId: job.id });
 if (!result.workflow.ready || result.workflow.status !== 'queued') throw new Error('Reply did not requeue');
 await cdp('Page.reload');
 await wait('document.body.innerText.includes("Epic, including Hephaestus.")');
 await Bun.sleep(1500);
 await wait('document.querySelector("button[role=switch]")');
 await evaluate('document.querySelector("button[role=switch]").click()');
 await wait('document.querySelector("button[role=switch]").getAttribute("aria-checked") === "false"');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
 if (await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Mobile horizontal overflow');
 if (errors.length) throw new Error(JSON.stringify(errors));
 console.log('PASS ready toggle, blocked message, browser reply automatically requeues, reload persistence, pause, mobile layout, no browser exceptions');
} finally {
 await api('job/delete', { id: job.id });
 ws.close();
}
