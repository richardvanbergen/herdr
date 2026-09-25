// Browser regression for confirmation, soft deletion and navigation.
// Requires a running isolated Charon server (seeded columns, no jobs) and
// Chromium with remote debugging enabled. Creates and removes synthetic jobs.
// CHARON_DELETE_TEST_ORIGIN=http://127.0.0.1:7001 \
// CHARON_DELETE_TEST_CDP=http://127.0.0.1:9233 bun scripts/check-board-drag.mjs
const origin = process.env.CHARON_DELETE_TEST_ORIGIN;
const cdpOrigin = process.env.CHARON_DELETE_TEST_CDP;
if (!origin || !cdpOrigin)
	throw new Error(
		"Set CHARON_DELETE_TEST_ORIGIN and CHARON_DELETE_TEST_CDP for an isolated test environment",
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
const job = await api('board/addJob', { columnId, title: 'Deletion browser test' });
try {
 await cdp('Page.navigate', { url: `${origin}/column/${columnId}/job/${job.id}` });
 await wait('document.querySelector("button[role=switch]")');
 await Bun.sleep(1500);
 const clickDelete = `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Delete job').click()`;
 await evaluate(clickDelete);
 await wait('document.querySelector("[role=dialog]")');
 if (!(await api('board/get')).columns.some(column => column.jobIds.includes(job.id))) throw new Error('Deleted before confirmation');
 await evaluate(`Array.from(document.querySelectorAll('[role=dialog] button')).find(button => button.textContent === 'Cancel').click()`);
 await wait('!document.querySelector("[role=dialog]")');
 if (!(await api('board/get')).columns.some(column => column.jobIds.includes(job.id))) throw new Error('Cancel deleted job');
 await evaluate(clickDelete);
 await wait('document.querySelector("[role=dialog]")');
 await evaluate(`Array.from(document.querySelectorAll('[role=dialog] button')).find(button => button.textContent === 'Delete job').click()`);
 await wait(`location.pathname === '/column/${columnId}'`);
 if ((await api('board/get')).columns.some(column => column.jobIds.includes(job.id))) throw new Error('Deleted job remains in board API');
 await evaluate(`Array.from(document.querySelectorAll('a')).find(link => link.textContent === 'Board').click()`);
 await wait(`location.pathname === '/'`);
 if (await evaluate(`document.querySelector('a[aria-label="Open job Deletion browser test"]') !== null`)) throw new Error('Ghost job on board');
 await cdp('Page.reload');
 await Bun.sleep(1500);
 if (await evaluate(`document.querySelector('a[aria-label="Open job Deletion browser test"]') !== null`)) throw new Error('Job returned after reload');
 await api('job/restore', { id: job.id });
 if (!(await api('board/get')).columns.some(column => column.jobIds.includes(job.id))) throw new Error('Restore failed');
 if (errors.length) throw new Error(JSON.stringify(errors));
 console.log('PASS confirmation, cancel, deletion redirect, board removal, reload, restore and no browser exceptions');
} finally {
 await api('job/delete', { id: job.id });
 ws.close();
}
