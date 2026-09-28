import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=(process.env.PAPERCLIP_TEST_SCRATCH || process.env.PAPERCLIP_RUN_SCRATCH_DIR)+'/repair';
const fixture=JSON.parse(readFileSync(root+'/browser-fixture.json'));
await fetch(fixture.base+'/test/fail-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:false})});
const reset=await fetch(fixture.base+`/api/agents/${fixture.id}/permissions`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({canAssignTasks:false,canCreateAgents:false,canCreateSkills:false})});assert.equal(reset.status,200);
const browser=spawn('chromium',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${root}/chromium-profile`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let err='';
const endpoint=await new Promise((resolve,reject)=>{browser.stderr.on('data',d=>{err+=d;const m=err.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)resolve(m[1]);});browser.on('exit',()=>reject(new Error(err)));});
const ws=new WebSocket(endpoint);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();let session;
function send(method,params={},sessionId=session){const id=++seq;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
ws.onmessage=({data})=>{const v=JSON.parse(data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}else if(v.method==='Fetch.requestPaused'){const url=v.params.request.url;void send(url.startsWith(fixture.base)||url.startsWith('data:')?'Fetch.continueRequest':'Fetch.failRequest',url.startsWith(fixture.base)||url.startsWith('data:')?{requestId:v.params.requestId}:{requestId:v.params.requestId,errorReason:'BlockedByClient'},v.sessionId);}};
async function evaluate(expression){return (await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await send('Page.navigate',{url:fixture.url});
 const switchExpr=`[...document.querySelectorAll('[role="switch"]')].find(e=>e.parentElement.innerText.includes('Can assign tasks'))`;
 for(let i=0;i<40;i++){if(await evaluate(`!!(${switchExpr})`))break;await delay(250);}
 const body=await evaluate('document.body.innerText');writeFileSync(root+'/browser-body.txt',body);console.log(body.slice(-1600));
 assert.equal(await evaluate(`!!(${switchExpr})`),true,'permission switch rendered');
 async function state(){return evaluate(`(${switchExpr}).getAttribute('aria-checked')`);}
 async function waitState(expected){for(let i=0;i<120;i++){if(await state()===expected)return;await delay(100);}assert.equal(await state(),expected);}
 assert.equal(await state(),'false');
 for(const next of ['true','false']){await evaluate(`(${switchExpr}).click()`);await waitState(next);await send('Page.reload');for(let i=0;i<40;i++){if(await evaluate(`!!(${switchExpr})`))break;await delay(100);}await waitState(next);}
 await fetch(fixture.base+'/test/fail-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
 await evaluate(`(${switchExpr}).click()`);await delay(1200);
 assert.equal(await state(),'false');
 const failedBody=await evaluate('document.body.innerText');assert.match(failedBody,/Isolated permission save rejection/);
 const screenshot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(root+'/browser-save-error.png',Buffer.from(screenshot.data,'base64'));
 console.log('PASS: actual shipped permission switch off → on → reload → off → reload; rejected save remains off and displays error.');
}catch(error){console.log(await evaluate('location.href + "\\n" + document.body.innerText'));throw error;}finally{ws.close();browser.kill('SIGTERM');}
