"""MCP transport for Charon's domain API. No database access or agent execution here."""
import asyncio
import json
import os
import urllib.request
import urllib.error
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

server = Server("charon")
base = os.environ.get("CHARON_API_URL", "http://127.0.0.1").rstrip("/")

def request(operation, payload):
    req = urllib.request.Request(
        f"{base}/api/workflow/{operation}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Charon {error.code}: {error.read().decode()}") from error

@server.list_tools()
async def list_tools():
    return [Tool(**item) for item in await asyncio.to_thread(request, "tools", {})]

@server.call_tool()
async def call_tool(name, arguments):
    if not name.startswith("charon_"):
        raise ValueError("Unknown Charon tool")
    result = await asyncio.to_thread(request, "agent", {
        "action": name.removeprefix("charon_"), "input": arguments or {},
    })
    return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
