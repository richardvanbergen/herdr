// Browser regression for React/dnd-kit DOM ownership across columns.
// Requires a running isolated Charon server (seeded columns, no jobs) and
// Chromium with remote debugging enabled. Creates and removes synthetic jobs.
// CHARON_DRAG_TEST_ORIGIN=http://127.0.0.1:7001 \
// CHARON_DRAG_TEST_CDP=http://127.0.0.1:9233 bun scripts/check-board-drag.mjs
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
const rect = async (title) =>
	evaluate(
		`(()=>{const e=[...document.querySelectorAll('input[aria-label="Job title"]')].find(e=>e.value===${JSON.stringify(title)});const item=e.closest('[data-slot="item"]');const r=item.getBoundingClientRect();const h=item.querySelector('button[aria-label^="Drag job"]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,handleX:h.x+h.width/2,handleY:h.y+h.height/2}})()`,
	);
const drag = async (from, to, previewColumnId) => {
 const before = previewColumnId ? await rpc("board/get") : null;
	await cdp("Input.dispatchMouseEvent", {
		type: "mouseMoved",
		x: from.x,
		y: from.y,
	});
	await cdp("Input.dispatchMouseEvent", {
		type: "mousePressed",
		x: from.x,
		y: from.y,
		button: "left",
		clickCount: 1,
	});
	for (let i = 1; i <= 16; i++) {
		await cdp("Input.dispatchMouseEvent", {
			type: "mouseMoved",
			x: from.x + ((to.x - from.x) * i) / 16,
			y: from.y + ((to.y - from.y) * i) / 16,
			buttons: 1,
		});
		await Bun.sleep(40);
	}
	await Bun.sleep(300);
 if (previewColumnId) {
   if (!await evaluate(`Boolean(document.querySelector('[data-column-id="${previewColumnId}"] [data-slot="job-drop-indicator"]'))`)) throw new Error("Missing cross-column insertion preview");
   if (JSON.stringify(await rpc("board/get")) !== JSON.stringify(before)) throw new Error("Preview persisted before drop");
   console.log("PASS insertion preview before drop, without persistence");
 }

	await cdp("Input.dispatchMouseEvent", {
		type: "mouseReleased",
		x: to.x,
		y: to.y,
		button: "left",
		clickCount: 1,
	});
	await Bun.sleep(1200);
 if (await evaluate(`Boolean(document.querySelector('[data-slot="job-drop-indicator"]'))`)) throw new Error("Insertion preview remained after drop");
};
try {
	const initial = await rpc("board/get");
	if (initial.columns.some((c) => c.jobIds.length))
		throw new Error("Use an isolated seeded database with no jobs");
	const emptyIds = initial.columns
		.filter((c) => !c.jobIds.length)
		.map((c) => c.id);
	if (emptyIds.length < 3) throw new Error("Need three empty test columns");
	const [sourceId, targetId, emptyId] = emptyIds;
	const a = await rpc("board/addJob", {
		columnId: sourceId,
		title: "Layout verification A",
		description: "Generated temporary test item",
	});
	ids.push(a.id);
	const b = await rpc("board/addJob", {
		columnId: sourceId,
		title: "Layout verification B",
		description: "Generated temporary test item",
	});
	ids.push(b.id);
	const c = await rpc("board/addJob", {
		columnId: targetId,
		title: "Layout verification C",
		description: "Generated temporary test item",
	});
	ids.push(c.id);
	await cdp("Emulation.setDeviceMetricsOverride", {
		width: 1440,
		height: 1000,
		deviceScaleFactor: 1,
		mobile: false,
	});
	await cdp("Page.reload");
	await wait(
		"[...document.querySelectorAll('input')].some(e=>e.value==='Layout verification A'&&Object.keys(e).some(k=>k.startsWith('__reactProps')))",
	);
	let ar = await rect(a.title),
		br = await rect(b.title);
  const beforeBodyDrag = await rpc("board/get");
  await drag({x: ar.x + 3, y: ar.y + 12}, {x: br.x + br.width / 2, y: br.y + br.height - 15});
  if (JSON.stringify(await rpc("board/get")) !== JSON.stringify(beforeBodyDrag)) throw new Error("Dragging the card body changed its placement");
  console.log("PASS only the grip handle starts dragging");

	await drag(
		{ x: ar.handleX, y: ar.handleY },
		{ x: br.x + br.width / 2, y: br.y + br.height - 15 },
	);
	let board = await rpc("board/get");
	let col = board.columns.find((c) => c.id === sourceId);
	if (
		col.jobIds.filter((id) => ids.includes(id)).join(",") !==
		[b.id, a.id].join(",")
	)
		throw new Error("Same-column reorder failed: " + JSON.stringify(col));
	console.log("PASS same-column reorder persists through API");
	ar = await rect(a.title);
	const cr = await rect(c.title);
	await drag(
		{ x: ar.handleX, y: ar.handleY },
		{ x: cr.x + cr.width / 2, y: cr.y + 20 },
 targetId,
	);
	board = await rpc("board/get");
	if (!board.columns.find((c) => c.id === targetId).jobIds.includes(a.id))
		throw new Error("Cross-column move failed");
	console.log("PASS cross-column drag persists through API");
	ar = await rect(a.title);
	br = await rect(b.title);
	await drag(
		{ x: ar.handleX, y: ar.handleY },
		{ x: br.x + br.width / 2, y: br.y + 20 },
	);
	board = await rpc("board/get");
	if (!board.columns.find((c) => c.id === sourceId).jobIds.includes(a.id))
		throw new Error("Round-trip drag failed: " + JSON.stringify(errors));
	if (await evaluate("document.body.innerText.includes('removeChild')"))
		throw new Error("React removeChild error visible");
	console.log("PASS round-trip without reload");
	for (let round = 0; round < 3; round++) {
		ar = await rect(a.title);
		const cr = await rect(c.title);
		await drag(
			{ x: ar.handleX, y: ar.handleY },
			{ x: cr.x + cr.width / 2, y: cr.y + 20 },
		);
		ar = await rect(a.title);
		br = await rect(b.title);
		await drag(
			{ x: ar.handleX, y: ar.handleY },
			{ x: br.x + br.width / 2, y: br.y + 20 },
		);
	}
	console.log("PASS three additional round trips without reload");
	ar = await rect(a.title);
	const empty = await evaluate(
		`(()=>{const r=document.querySelector('[data-column-id="${emptyId}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+180}})()`,
	);
	await drag({ x: ar.handleX, y: ar.handleY }, empty, emptyId);
	board = await rpc("board/get");
	if (!board.columns.find((c) => c.id === emptyId).jobIds.includes(a.id))
		throw new Error("Empty-column drop failed");
	ar = await rect(a.title);
	br = await rect(b.title);
	await drag(
		{ x: ar.handleX, y: ar.handleY },
		{ x: br.x + br.width / 2, y: br.y + 20 },
	);
	board = await rpc("board/get");
	if (!board.columns.find((c) => c.id === sourceId).jobIds.includes(a.id))
		throw new Error("Return from empty column failed");
	console.log("PASS empty-column round trip");

	await cdp("Page.reload");
	await wait(
		"[...document.querySelectorAll('input')].some(e=>e.value==='Layout verification A'&&Object.keys(e).some(k=>k.startsWith('__reactProps')))",
	);
	console.log("PASS reload after drag");
	await cdp("Emulation.setDeviceMetricsOverride", {
		width: 390,
		height: 844,
		deviceScaleFactor: 1,
		mobile: true,
	});
	console.log(
		"Mobile board",
		await evaluate(
			"JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth,columns:[...document.querySelectorAll('main section')].map(e=>({width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left}))})",
		),
	);
	if (errors.length)
		throw new Error("Browser exceptions: " + JSON.stringify(errors));
	console.log("PASS no browser exceptions");
} finally {
	for (const id of ids) await rpc("job/delete", { id });
	ws.close();
	console.log("Temporary jobs removed");
}
