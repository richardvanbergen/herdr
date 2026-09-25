// Browser regression for draft creation, insecure HTTP replies, and panel padding.
// Requires a running isolated Charon server (seeded columns, no jobs) and
// Chromium with remote debugging enabled. Creates and soft-deletes synthetic jobs.
// To reproduce HTTP restrictions, set CHARON_DRAFT_BROWSER_ORIGIN to a non-localhost
// hostname mapped to the test server with Chromium --host-resolver-rules.
// CHARON_DRAFT_TEST_ORIGIN=http://127.0.0.1:7001 \
// CHARON_DRAFT_TEST_CDP=http://127.0.0.1:9233 bun scripts/check-drafts.mjs
const origin = process.env.CHARON_DRAFT_TEST_ORIGIN;
const cdpOrigin = process.env.CHARON_DRAFT_TEST_CDP;
if (!origin || !cdpOrigin)
	throw new Error(
		"Set CHARON_DRAFT_TEST_ORIGIN and CHARON_DRAFT_TEST_CDP for an isolated test environment",
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
const browserOrigin = process.env.CHARON_DRAFT_BROWSER_ORIGIN ?? origin;
const board = await api('board/get');
const columnId = board.columns[0].id;
const initialIds = board.columns.flatMap(c => c.jobIds);
let jobId;
const fill = async (label, value) => evaluate(`(() => { const el = document.querySelector('[aria-label="' + ${JSON.stringify(label)} + '"]'); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const click = async text => evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
try {
 await cdp('Page.navigate', { url: `${browserOrigin}/column/${columnId}/job/new` });
 await wait("document.querySelector(\"[aria-label=\\\"Job title\\\"]\")");
 await Bun.sleep(1500);
 if (browserOrigin !== origin && await evaluate('typeof crypto.randomUUID !== "undefined"')) throw new Error('Expected insecure HTTP origin with randomUUID unavailable');
 await fill('Job title', 'Cancelled draft');
 await Bun.sleep(1000);
 if ((await api('board/get')).columns.flatMap(c => c.jobIds).length !== initialIds.length) throw new Error('Typing created a job');
 await click('Cancel');
 await wait(`location.pathname === '/column/${columnId}'`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Add job') || button.textContent.includes('Add Job')).click()`);
 await wait('location.pathname.endsWith("/job/new")');
 await fill('Job title', 'Draft test job');
 await fill('Job description', 'Save first, then autosave.');
 await click('Save');
 await wait('Number.isSafeInteger(Number(location.pathname.split("/").at(-1)))');
 jobId = Number((await evaluate('location.pathname')).split('/').at(-1));
 const saved = await api('job/get', { id: jobId });
 if (saved.title !== 'Draft test job') throw new Error('Job did not save');
 await fill('Job title', 'Autosaved job title');
 await Bun.sleep(1200);
 if ((await api('job/get', { id: jobId })).title !== 'Autosaved job title') throw new Error('Existing job did not autosave');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Add task')).click()`);
 await wait('location.pathname.endsWith("/task/new")');
 await fill('Task text', 'Unsaved instructions');
 await Bun.sleep(1000);
 if ((await api('task/list', { jobId })).length) throw new Error('Typing created a task');
 await cdp('Page.reload');
 await wait("document.querySelector(\"[aria-label=\\\"Task text\\\"]\")");
 await Bun.sleep(1500);
 if ((await api('task/list', { jobId })).length) throw new Error('Reload created a task');
 await fill('Task text', 'Write an epic poem.');
 await click('Save');
 await wait('Number.isSafeInteger(Number(location.pathname.split("/").at(-1)))');
 await wait("document.querySelector(\"[aria-label=\\\"Task text\\\"]\")");
 await fill('Task text', 'Write an epic poem with Hephaestus.');
 await Bun.sleep(1200);
 const tasks = await api('task/list', { jobId });
 if (tasks.length !== 1 || !tasks[0].text.includes('Hephaestus')) throw new Error('Task save/autosave failed');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim().toLowerCase() === 'discussion').click()`);
 await wait("document.querySelector(\"[aria-label=\\\"Reply to Hermes\\\"]\")");
 await fill('Reply to Hermes', 'HTTP reply test');
 await click('Reply');
 await wait("document.body.innerText.includes(\"HTTP reply test\") && document.querySelector('[aria-label=\"Reply to Hermes\"]').value === \"\"");
 const padding = await evaluate(`(() => { const item = document.querySelector('[aria-label="Agent workflow"]').closest('[data-slot="item"]'); return { item: parseFloat(getComputedStyle(item).paddingLeft), layout: parseFloat(getComputedStyle(item.parentElement).paddingLeft), overflow: getComputedStyle(item.parentElement).overflowY }; })()`);
 if (padding.item < 16 || padding.layout < 16 || padding.overflow !== 'auto') throw new Error('Missing standard workflow padding/scrolling: ' + JSON.stringify(padding));
 const workflow = await api('workflow/get', { jobId });
 if (!workflow.messages.some(m => m.content === 'HTTP reply test')) throw new Error('HTTP reply not saved');
 if (errors.length) throw new Error(JSON.stringify(errors));
 console.log('PASS insecure HTTP rendering/replies, no create on typing/cancel/reload, explicit Save, job/task autosave after creation, standard panel padding');
} finally {
 if (jobId) await api('job/delete', { id: jobId });
 ws.close();
}
