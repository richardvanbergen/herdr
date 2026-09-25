export async function* readJsonLines(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			while (true) {
				const newline = buffer.indexOf("\n");
				if (newline < 0) break;
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				if (line) yield JSON.parse(line);
			}
			if (done) break;
		}
		if (buffer.trim()) yield JSON.parse(buffer);
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
