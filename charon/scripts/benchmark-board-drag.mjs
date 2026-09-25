// Five-trial drag preview benchmark: production build, 8 jobs, 24 tasks.
// Requires a running isolated Charon server (seeded columns, no jobs) and
// Chromium with remote debugging enabled. Creates and removes synthetic jobs.
// CHARON_DRAG_TEST_ORIGIN=http://127.0.0.1:7001 \
// CHARON_DRAG_TEST_CDP=http://127.0.0.1:9233 BENCH_OUTPUT=/tmp/drag-preview.json bun scripts/benchmark-board-drag.mjs
if (!process.env.BENCH_OUTPUT)
	throw new Error("Set BENCH_OUTPUT to the result JSON path");
const origin = process.env.CHARON_DRAG_TEST_ORIGIN;
const cdpOrigin = process.env.CHARON_DRAG_TEST_CDP;
if (!origin || !cdpOrigin)
	throw new Error(
		"Set CHARON_DRAG_TEST_ORIGIN and CHARON_DRAG_TEST_CDP for an isolated test environment",
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
const requests = [];
ws.onmessage = (e) => {
	const m = JSON.parse(String(e.data));
	if (m.id) {
		pending.get(m.id)?.(m);
		pending.delete(m.id);
	} else if (m.method === "Runtime.exceptionThrown") errors.push(m.params);
	else if (m.method === "Network.requestWillBeSent")
		requests.push(m.params.request.url);
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

const rpc = async (name, input = {}) => {
	const r = await fetch(origin + "/api/rpc/" + name, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ json: input }),
	});
	const d = await r.json();
	if (!r.ok) throw new Error(JSON.stringify(d));
	return d.json;
};

const ids = [];
const samples = [];
try {
	const initial = await rpc("board/get");
	if (initial.columns.some((c) => c.jobIds.length))
		throw new Error("Isolated empty board required");
	for (let i = 0; i < 8; i++) {
		const job = await rpc("board/addJob", {
			columnId: initial.columns[i % 4].id,
			title: `Preview benchmark ${i}`,
			description: "Synthetic description for the drag preview benchmark.",
		});
		ids.push(job.id);
		for (let t = 0; t < 3; t++)
			await rpc("task/create", {
				jobId: job.id,
				text: `Synthetic task ${t} with instructions for this job.`,
			});
	}
	await cdp("Emulation.setDeviceMetricsOverride", {
		width: 1440,
		height: 1000,
		deviceScaleFactor: 1,
		mobile: false,
	});
	await cdp("Page.reload");
	await wait(
		"[...document.querySelectorAll('button[aria-label=\"Drag job Preview benchmark 0\"]')].some(e=>Object.keys(e).some(k=>k.startsWith('__reactProps')))",
	);
	await Bun.sleep(2000);
	await cdp("Network.enable");
	await cdp("Performance.enable");
	const styles = await evaluate(
		"({margin:getComputedStyle(document.body).margin,background:getComputedStyle(document.querySelector('body>div')).backgroundColor,columns:[...document.querySelectorAll('[data-column-id]')].map(e=>e.getBoundingClientRect().width)})",
	);
	console.log("Styles", styles);
	if (styles.margin !== "0px" || styles.columns[0] > 500)
		throw new Error("Production styles not applied");
	const metric = async () =>
		Object.fromEntries(
			(await cdp("Performance.getMetrics")).result.metrics.map((m) => [
				m.name,
				m.value,
			]),
		);
	for (let trial = 0; trial < 5; trial++) {
		const h = await evaluate(
			"(()=>{const r=document.querySelector('button[aria-label=\"Drag job Preview benchmark 0\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()",
		);
		const before = await metric();
		requests.length = 0;
		await evaluate(
			"window.dragFrames=[];window.dragFrameLast=performance.now();window.dragFrameLoop=()=>{const now=performance.now();window.dragFrames.push(now-window.dragFrameLast);window.dragFrameLast=now;window.dragRaf=requestAnimationFrame(window.dragFrameLoop)};window.dragRaf=requestAnimationFrame(window.dragFrameLoop)",
		);
		const start = performance.now();
		await cdp("Input.dispatchMouseEvent", {
			type: "mousePressed",
			x: h.x,
			y: h.y,
			button: "left",
			clickCount: 1,
		});
		await cdp("Input.dispatchMouseEvent", {
			type: "mouseMoved",
			x: h.x + 15,
			y: h.y + 10,
			buttons: 1,
		});
		const activationMs = performance.now() - start;
		for (let i = 0; i < 35; i++) {
			await cdp("Input.dispatchMouseEvent", {
				type: "mouseMoved",
				x: h.x + 15 + i * 2,
				y: h.y + 10,
				buttons: 1,
			});
			await Bun.sleep(16);
		}
		const editors = await evaluate(
			"document.querySelectorAll('input[aria-label=\"Job title\"]').length",
		);
		const frames = await evaluate(
			"cancelAnimationFrame(window.dragRaf);window.dragFrames",
		);
		const after = await metric();
		samples.push({
			trial,
			activationMs,
			editors,
			taskRequests: requests.filter((u) => u.includes("/task/list")).length,
			scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
			layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
			framesOver25ms: frames.filter((n) => n > 25).length,
			frameP95: frames.sort((a, b) => a - b)[Math.floor(frames.length * 0.95)],
		});
		await cdp("Input.dispatchKeyEvent", {
			type: "keyDown",
			key: "Escape",
			code: "Escape",
			windowsVirtualKeyCode: 27,
		});
		await cdp("Input.dispatchKeyEvent", {
			type: "keyUp",
			key: "Escape",
			code: "Escape",
			windowsVirtualKeyCode: 27,
		});
		await cdp("Input.dispatchMouseEvent", {
			type: "mouseReleased",
			x: h.x + 83,
			y: h.y + 10,
			button: "left",
			clickCount: 1,
		});
		await Bun.sleep(400);
	}
	console.log(JSON.stringify(samples, null, 2));
	if (errors.length) throw new Error(JSON.stringify(errors));
	await Bun.write(
		process.env.BENCH_OUTPUT,
		JSON.stringify({ styles, samples }, null, 2),
	);
} finally {
	for (const id of ids) await rpc("job/delete", { id });
	ws.close();
}
