"""Run with an isolated seeded Charon server; creates and cleans one test job.
Client may use Hermes SDK v2; server uses the Nix-pinned SDK v1 runtime.
"""
import asyncio, json, os, sys, urllib.request
from pathlib import Path

BASE = os.environ["CHARON_MCP_TEST_ORIGIN"].rstrip("/")
SERVER_PYTHON = os.environ.get("CHARON_MCP_SERVER_PYTHON", sys.executable)
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

def api(name, data):
    req=urllib.request.Request(BASE+'/api/'+name,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as r: return json.load(r)
async def main():
    board=api('board/get',{})
    job=api('board/addJob',{'columnId':board['columns'][0]['id'],'title':'MCP integration test'})
    try:
        params=StdioServerParameters(command=SERVER_PYTHON,args=[str(Path(__file__).with_name('mcp_server.py'))],env={**os.environ,'CHARON_API_URL':BASE})
        async with stdio_client(params) as (r,w):
            async with ClientSession(r,w) as session:
                await session.initialize()
                listed=await session.list_tools()
                assert 'charon_run_task' in [t.name for t in listed.tools]
                api('workflow/ready',{'jobId':job['id'],'ready':True})
                lease=await session.call_tool('charon_claim',{'jobId':job['id']})
                assert not getattr(lease, "is_error", getattr(lease, "isError", False)), lease
                token=json.loads(lease.content[0].text)['token']
                result=await session.call_tool('charon_finish',{'jobId':job['id'],'token':token,'status':'blocked','content':'Which poem style?','requestId':'mcp-test-question'})
                assert not getattr(result, "is_error", getattr(result, "isError", False)), result
                assert 'http://herdr/column/' in json.loads(result.content[0].text)['notification']
                api('workflow/reply',{'jobId':job['id'],'content':'Epic, featuring Hephaestus.','requestId':'mcp-test-answer'})
                queued=await session.call_tool('charon_queue',{})
                assert job['id'] in [row['jobId'] for row in json.loads(queued.content[0].text)['jobs']]
                print('PASS MCP initialize, tool discovery, claim, blocked notification, human reply, requeue')
    finally: api('job/delete',{'id':job['id']})
asyncio.run(main())
