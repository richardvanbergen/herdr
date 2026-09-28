import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createDb, closeRegisteredClients, companies, agents, companyMemberships, principalPermissionGrants, issues, heartbeatRuns } from '@paperclipai/db';
import { eq } from 'drizzle-orm';
const { authorizationService } = await import(new URL('dist/services/authorization.js', process.env.PAPERCLIP_TEST_SERVER_URL || new URL('./server/', import.meta.url)));
const { agentRoutes } = await import(new URL('dist/routes/agents.js', process.env.PAPERCLIP_TEST_SERVER_URL || new URL('./server/', import.meta.url)));
const { issueRoutes } = await import(new URL('dist/routes/issues.js', process.env.PAPERCLIP_TEST_SERVER_URL || new URL('./server/', import.meta.url)));
const url = 'postgresql:///postgres';
assert.equal(process.env.PGHOST, (process.env.PAPERCLIP_TEST_SCRATCH || process.env.PAPERCLIP_RUN_SCRATCH_DIR) + '/pg-socket', 'tests require isolated scratch socket');
const db = createDb(url);
const companyId = randomUUID();
await db.insert(companies).values({id:companyId,name:'Permission regression',issuePrefix: 'T' + Date.now()});
const authz = authorizationService(db);
let actor;
const app = express();
app.use(express.json());
app.use((req,res,next)=>{req.actor=actor; next();});
app.use(agentRoutes(db));
app.use(issueRoutes(db, {}));
app.use((err,req,res,next)=>res.status(err.status || err.statusCode || 500).json({error:err.message,details:err.details}));
const server = app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(async()=>{await new Promise(resolve=>server.close(resolve));await closeRegisteredClients(url);});
const board = {type:'board',source:'local_implicit',isInstanceAdmin:true,companyIds:[companyId]};
async function fixture(permissions={},extra={}) {
 const id=randomUUID();
 await db.insert(agents).values({id,companyId,name:'Test agent',permissions:{canCreateAgents:false,...permissions},runtimeConfig:{heartbeat:{enabled:false}},...extra});
 await db.insert(companyMemberships).values({companyId,principalType:'agent',principalId:id,membershipRole:'member',status:'active'});
 return id;
}
function identity(id,extra={}) {return {type:'agent',agentId:id,companyId,source:'heartbeat',...extra};}
async function decide(id, resource={}, identityExtra={}) {return authz.decide({actor:identity(id,identityExtra),action:'tasks:assign',resource:{type:'issue',companyId,...resource}});}
async function request(method,path,body) {const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json', ...(actor?.runId ? {'X-Paperclip-Run-Id':actor.runId} : {})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
for (const staleGrant of [false,true]) test(`explicit off denies effective access and assignment, stale grant=${staleGrant}`,async()=>{
 const id=await fixture({canAssignTasks:false});
 if(staleGrant) await db.insert(principalPermissionGrants).values({companyId,principalType:'agent',principalId:id,permissionKey:'tasks:assign'});
 actor=board;
 const detail=await request('GET',`/agents/${id}`);
 assert.equal(detail.status,200,JSON.stringify(detail.body));
 assert.equal(detail.body.access.canAssignTasks,false);
 assert.equal((await decide(id)).allowed,false);
});
test('off denies real create route with another assignee without persistence',async()=>{
 const id=await fixture({canAssignTasks:false}), target=await fixture(); actor=identity(id);
 const title='must-not-persist-'+randomUUID();
 const r=await request('POST',`/companies/${companyId}/issues`,{title,assigneeAgentId:target});
 assert.equal(r.status,403,JSON.stringify(r.body));
 assert.equal((await db.select().from(issues).where(eq(issues.title,title))).length,0);
});
test('legacy unset and true remain bounded, privileged exceptions remain',async()=>{
 for(const permissions of [{},{canAssignTasks:true},{canAssignTasks:false,canCreateAgents:true}]){
 const id=await fixture(permissions); assert.equal((await decide(id)).allowed,true);
 assert.equal((await decide(id,{companyId:randomUUID()})).allowed,false);
 }
 const ceo=await fixture({canAssignTasks:false},{role:'ceo'});assert.equal((await decide(ceo)).allowed,true);
 const paused=await fixture({canAssignTasks:true},{status:'terminated'});assert.equal((await decide(paused)).allowed,false);
});
test('admin off/on/off round trip and unauthorized edits',async()=>{
 const id=await fixture();
 for(const value of [false,true,false]){
 actor=board;
 const r=await request('PATCH',`/agents/${id}/permissions`,{canCreateAgents:false,canCreateSkills:false,canAssignTasks:value});
 assert.equal(r.status,200,JSON.stringify(r.body));
 const reloaded=await request('GET',`/agents/${id}`);
 assert.equal(reloaded.body.permissions.canAssignTasks,value);
 assert.equal(reloaded.body.access.canAssignTasks,value);
 assert.equal((await decide(id)).allowed,value);
 }
 actor=identity(id);assert.equal((await request('PATCH',`/agents/${id}/permissions`,{canCreateAgents:false,canCreateSkills:false,canAssignTasks:true})).status,403);
});
async function issueFixture(id) {
 const issueId=randomUUID();
 await db.insert(issues).values({id:issueId,companyId,title:'Owned regression '+issueId,assigneeAgentId:id,status:'in_progress'});
 return issueId;
}
test('off blocks reassignment and child delegation at real routes',async()=>{
 const id=await fixture({canAssignTasks:false}), target=await fixture();
 const issueId=await issueFixture(id); actor=await runIdentity(id,issueId);
 const r=await request('PATCH',`/issues/${issueId}`,{assigneeAgentId:target});
 assert.equal(r.status,403,JSON.stringify(r.body));
 assert.match(JSON.stringify(r.body),/Task assignment is disabled/);
 assert.equal((await db.select().from(issues).where(eq(issues.id,issueId)))[0].assigneeAgentId,id);
 const title='child-denied-'+randomUUID();
 const child=await request('POST',`/issues/${issueId}/children`,{title,assigneeAgentId:target});
 assert.equal(child.status,403,JSON.stringify(child.body));
 assert.match(JSON.stringify(child.body),/Task assignment is disabled/);
 assert.equal((await db.select().from(issues).where(eq(issues.title,title))).length,0);
});
test('off retains read, comment, completion and head assignment',async()=>{
 const id=await fixture({canAssignTasks:false}), head=await fixture();
 const issueId=await issueFixture(id); actor=await runIdentity(id,issueId);
 assert.equal((await request('GET',`/issues/${issueId}`)).status,200);
 const comment=await request('POST',`/issues/${issueId}/comments`,{body:'Isolated regression comment'});
 assert.equal(comment.status,201,JSON.stringify(comment.body));
 const completed=await request('PATCH',`/issues/${issueId}`,{status:'done'});
 assert.equal(completed.status,200,JSON.stringify(completed.body));
 assert.equal(completed.body.status,'done');
 const assigned=await issueFixture(head); actor=await runIdentity(head,assigned);
 const received=await request('PATCH',`/issues/${assigned}`,{assigneeAgentId:id});
 assert.equal(received.status,200,JSON.stringify(received.body));
 assert.equal(received.body.assigneeAgentId,id);
});
test('task bridge cannot bypass off',async()=>{
 const id=await fixture({canAssignTasks:false}), target=await fixture(), projectId=randomUUID();
 const context={source:'agent_key',keyId:randomUUID(),keyScope:{kind:'task_bridge',projectId,allowedAssigneeAgentIds:[target]}};
 const result=await decide(id,{projectId,assigneeAgentId:target},context);
 assert.equal(result.allowed,false); assert.match(result.explanation,/disabled/);
});
test('true cannot bypass protected targets, invalid parent visibility or low trust',async()=>{
 const id=await fixture({canAssignTasks:true});
 const target=await fixture({authorizationPolicy:{protectedAgent:{blockAssignment:true}}});
 assert.equal((await decide(id,{assigneeAgentId:target})).allowed,false);
 const privateTarget=await fixture({authorizationPolicy:{agentVisibility:{mode:'private'}}});
 assert.equal((await decide(id,{assigneeAgentId:privateTarget})).allowed,false);
 assert.equal((await decide(id,{parentIssueId:randomUUID()})).allowed,false);
 const lowTrust=await fixture({canAssignTasks:true,trustPreset:'low_trust_review'});
 assert.equal((await decide(lowTrust)).allowed,false);
});

async function runIdentity(id,issueId) {
 const runId=randomUUID();
 await db.insert(heartbeatRuns).values({id:runId,companyId,agentId:id,status:'running',contextSnapshot:{issueId}});
 await db.update(issues).set({checkoutRunId:runId,executionRunId:runId}).where(eq(issues.id,issueId));
 return identity(id,{runId});
}

test('off blocks checkout reassignment and accepted-plan child assignments',async()=>{
 const id=await fixture({canAssignTasks:false}), target=await fixture();
 const source=await issueFixture(id);actor=await runIdentity(id,source);
 const title='decomposition-denied-'+randomUUID();
 const r=await request('POST',`/issues/${source}/accepted-plan-decompositions`,{acceptedPlanRevisionId:randomUUID(),children:[{title,assigneeAgentId:target}]});
 assert.equal(r.status,403,JSON.stringify(r.body)); assert.match(JSON.stringify(r.body),/Task assignment is disabled/);
 assert.equal((await db.select().from(issues).where(eq(issues.title,title))).length,0);
 const unassigned=randomUUID();await db.insert(issues).values({id:unassigned,companyId,title:'Unassigned checkout fixture',status:'todo'});
 const checkout=await request('POST',`/issues/${unassigned}/checkout`,{agentId:id,expectedStatuses:['todo']});
 assert.equal(checkout.status,403,JSON.stringify(checkout.body));assert.match(JSON.stringify(checkout.body),/Task assignment is disabled/);
 assert.equal((await db.select().from(issues).where(eq(issues.id,unassigned)))[0].assigneeAgentId,null);
});
test('off cannot accept suggested tasks to delegate to another agent',async()=>{
 const id=await fixture({canAssignTasks:false}),target=await fixture(),issueId=await issueFixture(id);
 const agentIdentity=await runIdentity(id,issueId);actor=board;
 const title='suggestion-denied-'+randomUUID();
 const card=await request('POST',`/issues/${issueId}/interactions`,{kind:'suggest_tasks',title:'Isolated delegation fixture',continuationPolicy:'none',payload:{version:1,tasks:[{clientKey:'one',title,assigneeAgentId:target}]}});
 assert.equal(card.status,201,JSON.stringify(card.body));actor=agentIdentity;
 const accepted=await request('POST',`/issues/${issueId}/interactions/${card.body.id}/accept`,{selectedClientKeys:['one']});
 assert.equal(accepted.status,403,JSON.stringify(accepted.body));assert.equal(accepted.body.code,'interaction_governed_action_denied');
 assert.equal((await db.select().from(issues).where(eq(issues.title,title))).length,0);
 await db.update(agents).set({permissions:{canAssignTasks:true,canCreateAgents:false}}).where(eq(agents.id,id));
 const permitted=await request('POST',`/issues/${issueId}/interactions/${card.body.id}/accept`,{selectedClientKeys:['one']});
 assert.equal(permitted.status,200,JSON.stringify(permitted.body));
 assert.equal((await db.select().from(issues).where(eq(issues.title,title))).length,1);
});
