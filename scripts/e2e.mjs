// Integration test against your Supabase project. Needs two confirmed test accounts.
// Run:  E2E_SEEKER_EMAIL=.. E2E_SEEKER_PASSWORD=.. E2E_SOLVER_EMAIL=.. E2E_SOLVER_PASSWORD=.. npm run test:e2e
// Creates rows titled "E2E: ..." in that project. Use a test project, or delete them afterwards.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split(/=(.*)/s).slice(0,2)))
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const seeker = mk(), solver = mk()
let fails = 0
const ok = (name, cond, extra='') => { console.log((cond?'PASS ':'FAIL ')+name+(extra?'  -> '+extra:'')); if(!cond) fails++ }
const must = (name, r) => { ok(name, !r.error, r.error?.message); return r.data }
const expectErr = (name, r) => ok(name, !!r.error, r.error ? r.error.message : 'unexpectedly allowed')

const a = await seeker.auth.signInWithPassword({ email: process.env.E2E_SEEKER_EMAIL, password: process.env.E2E_SEEKER_PASSWORD })
ok('seeker sign in', !a.error, a.error?.message)
const b = await solver.auth.signInWithPassword({ email: process.env.E2E_SOLVER_EMAIL, password: process.env.E2E_SOLVER_PASSWORD })
ok('solver sign in', !b.error, b.error?.message)
if (a.error || b.error) process.exit(1)
const S = a.data.user.id, V = b.data.user.id

must('seeker profile exists', await seeker.from('profiles').select('*').eq('id', S).single())
must('solver profile exists', await solver.from('profiles').select('*').eq('id', V).single())
must('seeker onboarding', await seeker.from('profiles').update({ intent:'seeker', city:'Kochi', state:'Kerala', onboarded_at:new Date().toISOString() }).eq('id', S))
must('solver onboarding', await solver.from('profiles').update({ intent:'solver', headline:'Full-stack developer', city:'Kochi', state:'Kerala', availability_status:'open', onboarded_at:new Date().toISOString() }).eq('id', V))
expectErr('cannot make self admin', await solver.from('profiles').update({ is_admin:true }).eq('id', V))

const skills = must('skills readable', await seeker.from('skills').select('id,name').in('name',['Python','Web development','React']))
const sk = n => skills.find(s=>s.name===n).id
must('solver skills', await solver.from('user_skills').upsert([
  { user_id:V, skill_id:sk('Python'), proficiency:3, years:4 },
  { user_id:V, skill_id:sk('Web development'), proficiency:4, years:5 } ]))

const c = must('create case', await seeker.from('cases').insert({ owner_id:S, title:'E2E: Build a small website', description:'I need a developer to build a simple website with Python backend.', city:'Kochi', state:'Kerala', visibility:'matched_only' }).select('id').single())
const caseId = c.id
expectErr('publish without skills blocked', await seeker.rpc('publish_case', { p_case: caseId }))
must('case skills', await seeker.from('case_skills').insert([{ case_id:caseId, skill_id:sk('Python'), importance:3 },{ case_id:caseId, skill_id:sk('Web development'), importance:2 }]))
const direct = await seeker.from('cases').update({ status:'resolved' }).eq('id', caseId)
expectErr('direct status update blocked', direct)
must('publish', await seeker.rpc('publish_case', { p_case: caseId }))
const early = await solver.from('cases').select('id').eq('id', caseId).maybeSingle()
ok('solver cannot see case before match', !early.data)

const n = must('run_matching', await seeker.rpc('run_matching', { p_case: caseId }))
ok('matching found the solver', n >= 1, 'count='+n)
const ms = must('read matches', await seeker.from('matches').select('*').eq('case_id', caseId))
const mine = ms?.find(m=>m.profile_id===V)
ok('solver is in matches', !!mine)
if (mine) { console.log('   score', mine.score, '|', mine.explanation); console.log('   breakdown', JSON.stringify(mine.breakdown)) }
ok('seeker not matched with self', !ms?.some(m=>m.profile_id===S))
const sm = must('solver sees own match', await solver.from('matches').select('id').eq('case_id', caseId))
ok('solver sees only their row', sm?.length===1)
ok('solver can now view matched_only case', !!(await solver.from('cases').select('id').eq('id', caseId).maybeSingle()).data)
expectErr('solver cannot run matching', await solver.rpc('run_matching', { p_case: caseId }))

const conn = must('send_request', await seeker.rpc('send_request', { p_case:caseId, p_solver:V, p_message:'Can you help?' }))
expectErr('duplicate request blocked', await seeker.rpc('send_request', { p_case:caseId, p_solver:V, p_message:'again' }))
const nv = must('solver notifications', await solver.from('notifications').select('kind,title'))
ok('request notification exists', nv?.some(x=>x.kind==='request_received'))
expectErr('message blocked before accept', await seeker.from('messages').insert({ connection_id:conn, sender_id:S, body:'hi' }))
expectErr('initiator cannot accept own request', await seeker.rpc('transition_connection', { p_id:conn, p_action:'accept' }))
must('solver asks question', await solver.rpc('transition_connection', { p_id:conn, p_action:'ask' }))
must('solver clarification msg', await solver.from('messages').insert({ connection_id:conn, sender_id:V, body:'What budget?' }))
must('seeker answers', await seeker.from('messages').insert({ connection_id:conn, sender_id:S, body:'Around 20k' }))
must('seeker responds', await seeker.rpc('transition_connection', { p_id:conn, p_action:'respond' }))
must('solver accepts', await solver.rpc('transition_connection', { p_id:conn, p_action:'accept' }))
const cs = must('read case status', await seeker.from('cases').select('status').eq('id', caseId).single())
ok('status is in_progress', cs?.status==='in_progress', cs?.status)
must('chat seeker->solver', await seeker.from('messages').insert({ connection_id:conn, sender_id:S, body:'Welcome aboard' }))
must('chat solver->seeker', await solver.from('messages').insert({ connection_id:conn, sender_id:V, body:'Thanks!' }))
const msgs = must('read messages', await solver.from('messages').select('body').eq('connection_id', conn).order('created_at'))
ok('4 messages visible', msgs?.length===4, msgs?.map(m=>m.body).join(' | '))
expectErr('cannot send as someone else', await solver.from('messages').insert({ connection_id:conn, sender_id:S, body:'spoof' }))
const nS = must('seeker notifications', await seeker.from('notifications').select('kind'))
ok('seeker has accepted notification', nS?.some(x=>x.kind==='request_accepted'))

const ms1 = must('add milestone', await seeker.from('milestones').insert({ case_id:caseId, title:'Design done', position:0, created_by:S }).select('id').single())
must('solver adds milestone', await solver.from('milestones').insert({ case_id:caseId, title:'Launch', position:1, created_by:V }))
must('add task', await solver.from('tasks').insert({ case_id:caseId, title:'Draft pages', assignee_id:V, milestone_id:ms1.id, created_by:V }))
const t = must('read tasks as seeker', await seeker.from('tasks').select('id,status'))
must('seeker updates task', await seeker.from('tasks').update({ status:'doing' }).eq('id', t[0].id))
must('progress update', await solver.from('progress_updates').insert({ case_id:caseId, author_id:V, body:'Started work' }))
must('milestone done', await solver.from('milestones').update({ status:'done' }).eq('id', ms1.id))
const del = await solver.from('milestones').delete().eq('id', ms1.id).select()
ok('solver cannot delete milestone', !del.error && del.data.length===0)

expectErr('seeker cannot confirm before proposal', await seeker.rpc('respond_resolution', { p_case:caseId, p_accept:true }))
must('solver proposes resolution', await solver.rpc('propose_resolution', { p_case:caseId, p_summary:'Site delivered' }))
expectErr('solver cannot confirm', await solver.rpc('respond_resolution', { p_case:caseId, p_accept:true }))
must('seeker rejects', await seeker.rpc('respond_resolution', { p_case:caseId, p_accept:false }))
must('solver proposes again', await solver.rpc('propose_resolution', { p_case:caseId, p_summary:'Fixed issues' }))
expectErr('feedback before resolved blocked', await seeker.rpc('submit_feedback', { p_case:caseId, p_to:V, p_outcome:'resolved', p_rating:5, p_comment:'' }))
must('seeker confirms', await seeker.rpc('respond_resolution', { p_case:caseId, p_accept:true }))
must('feedback seeker->solver', await seeker.rpc('submit_feedback', { p_case:caseId, p_to:V, p_outcome:'resolved', p_rating:5, p_comment:'Great' }))
must('feedback solver->seeker', await solver.rpc('submit_feedback', { p_case:caseId, p_to:S, p_outcome:'resolved', p_rating:4, p_comment:'' }))
expectErr('duplicate feedback blocked', await seeker.rpc('submit_feedback', { p_case:caseId, p_to:V, p_outcome:'resolved', p_rating:5, p_comment:'' }))
expectErr('feedback to self blocked', await seeker.rpc('submit_feedback', { p_case:caseId, p_to:S, p_outcome:'resolved', p_rating:5, p_comment:'' }))
must('reopen', await seeker.rpc('reopen_case', { p_case:caseId }))
const st = must('final status', await seeker.from('cases').select('status').eq('id', caseId).single())
ok('reopened to in_progress', st?.status==='in_progress', st?.status)

const c2 = must('public case', await seeker.from('cases').insert({ owner_id:S, title:'E2E: Public Python help', description:'Need Python tips.', visibility:'public_anonymised' }).select('id').single())
must('public case skills', await seeker.from('case_skills').insert({ case_id:c2.id, skill_id:sk('Python'), importance:2 }))
must('publish public', await seeker.rpc('publish_case', { p_case:c2.id }))
const anon = mk()
const pub = must('anon sees public_cases', await anon.from('public_cases').select('*').eq('id', c2.id))
ok('public view returns case without owner', pub?.length===1 && !('owner_id' in pub[0]))
const anonCase = await anon.from('cases').select('id').eq('id', c2.id)
ok('anon cannot read cases table', !anonCase.data || anonCase.data.length===0)
const offer = must('solver offers help', await solver.rpc('send_request', { p_case:c2.id, p_solver:V, p_message:'I can' }))
expectErr('solver cannot offer on non-public case', await solver.rpc('send_request', { p_case:caseId, p_solver:V, p_message:'x' }))
expectErr('initiator solver cannot accept', await solver.rpc('transition_connection', { p_id:offer, p_action:'accept' }))
must('seeker accepts offer', await seeker.rpc('transition_connection', { p_id:offer, p_action:'accept' }))
must('seeker closes case', await seeker.rpc('close_case', { p_case:c2.id }))
const oc = must('read offer connection', await solver.from('connections').select('status').eq('id', offer).single())
ok('connection closed with case', oc?.status==='closed', oc?.status)


// ============================================================
// Phase 9 checks (need supabase/phase9.sql applied)
// ============================================================
const has9 = !(await seeker.from('resources').select('id').limit(1)).error
if (!has9) {
  console.log('\nSKIP phase 9 checks: run supabase/phase9.sql first')
} else {
  console.log('\n-- phase 9: resources')
  const cats = must('categories', await seeker.from('categories').select('id,name'))
  const tech = cats.find(c => c.name === 'Technology & Software').id
  const res = must('solver offers a digital resource', await solver.from('resources').insert({ owner_id:V, direction:'offer', title:'E2E: Python course notes', description:'Python notes and exercises', kind:'digital', category_id:tech, city:'Kochi', state:'Kerala' }).select('id').single())
  expectErr('cannot set hidden_by_admin on own resource', await solver.from('resources').update({ hidden_by_admin:true }).eq('id', res.id))
  const c3 = must('case for resource matching', await seeker.from('cases').insert({ owner_id:S, title:'E2E: Learn Python basics', description:'Need Python learning material.', category_id:tech, visibility:'private', city:'Kochi', state:'Kerala' }).select('id').single())
  must('case 3 skills', await seeker.from('case_skills').insert({ case_id:c3.id, skill_id:sk('Python'), importance:2 }))
  must('publish case 3', await seeker.rpc('publish_case', { p_case:c3.id }))
  const rfc = must('resources_for_case', await seeker.rpc('resources_for_case', { p_case:c3.id }))
  ok('resource is suggested with a reason', rfc?.some(r => r.id === res.id && r.reason), rfc?.find(r=>r.id===res.id)?.reason)
  expectErr('solver cannot ask for matches of another person case', await solver.rpc('resources_for_case', { p_case:c3.id }))
  const rc = must('request_resource', await seeker.rpc('request_resource', { p_case:c3.id, p_resource:res.id, p_message:'Can I use these?' }))
  const vc = must('solver sees resource request', await solver.from('connections').select('resource_id,status').eq('id', rc).single())
  ok('request points at the resource', vc?.resource_id === res.id && vc?.status === 'pending')
  must('solver marks resource unavailable', await solver.from('resources').update({ status:'unavailable' }).eq('id', res.id))
  const hid = await seeker.from('resources').select('id').eq('id', res.id)
  ok('unavailable resource hidden from others', !hid.error && hid.data.length === 0)
  must('solver marks available again', await solver.from('resources').update({ status:'available' }).eq('id', res.id))

  console.log('-- phase 9: blocks')
  must('solver declines resource request', await solver.rpc('transition_connection', { p_id:rc, p_action:'decline' }))
  must('seeker blocks solver', await seeker.rpc('block_user', { p_user:V }))
  expectErr('blocked: seeker cannot invite solver', await seeker.rpc('send_request', { p_case:c3.id, p_solver:V, p_message:'hi' }))
  expectErr('blocked: solver cannot offer help', await solver.rpc('send_request', { p_case:c2.id, p_solver:V, p_message:'hi' }))
  const m2 = must('matching after block', await seeker.rpc('run_matching', { p_case:c3.id }))
  const m2rows = must('matches after block', await seeker.from('matches').select('profile_id').eq('case_id', c3.id))
  ok('blocked person removed from matches', !m2rows?.some(r => r.profile_id === V), 'count='+m2)
  const bl = must('seeker sees own blocks', await seeker.from('blocks').select('blocked_id'))
  ok('block listed', bl?.some(b => b.blocked_id === V))
  const sb = await solver.from('blocks').select('blocked_id')
  ok('solver cannot see seeker blocks', !sb.error && sb.data.length === 0)
  must('seeker unblocks', await seeker.from('blocks').delete().eq('blocker_id', S).eq('blocked_id', V))

  console.log('-- phase 9: reports')
  const rep = must('seeker reports resource', await seeker.from('reports').insert({ reporter_id:S, target_type:'resource', target_id:res.id, reason:'spam', details:'E2E test report' }).select('id').single())
  expectErr('cannot report as someone else', await seeker.from('reports').insert({ reporter_id:V, target_type:'user', target_id:S, reason:'spam' }))
  const own = must('read own reports', await seeker.from('reports').select('id'))
  ok('reporter sees own report', own?.some(r => r.id === rep.id))
  const other = await solver.from('reports').select('id')
  ok('others cannot read reports', !other.error && other.data.length === 0)
  const na = await seeker.rpc('admin_overview')
  ok('non-admin blocked from admin overview', !!na.error, na.error?.message)

  console.log('-- phase 9: verification')
  expectErr('cannot self-verify', await seeker.from('profiles').update({ verification:'id' }).eq('id', S))
  let vr
{
  const ins = await seeker.from('verification_requests').insert({ user_id:S, note:'E2E' }).select('id').single()
  if (ins.error) {
    // an earlier run left one open: reuse it
    const open = await seeker.from('verification_requests').select('id').eq('status','submitted').single()
    ok('request verification (reusing open one)', !open.error, open.error?.message)
    vr = open.data
  } else { ok('request verification', true); vr = ins.data }
}
  expectErr('second open request blocked', await seeker.from('verification_requests').insert({ user_id:S, note:'again' }))

  console.log('-- phase 9: admin (needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD of an admin account)')
  const admin = mk()
  const ad = process.env.E2E_ADMIN_EMAIL ? await admin.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }) : null
  const ov = ad && !ad.error ? await admin.rpc('admin_overview') : { error: { message: 'no admin' } }
  if (ov.error) {
    console.log('SKIP admin checks: set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for an account with is_admin = true')
  } else {
    const A = ad.data.user.id
    ok('admin overview works', typeof ov.data?.users === 'number', JSON.stringify(ov.data))
    const q = must('admin reports queue', await admin.rpc('admin_reports', { p_status:'open' }))
    ok('admin sees the report with label', q?.some(r => r.id === rep.id && r.target_label))
    const us = must('admin people list', await admin.rpc('admin_users', { p_q:'junaid' }))
    ok('admin sees emails in people list', us?.some(u => u.email))
    const cs2 = must('admin problems list', await admin.rpc('admin_cases', { p_status:'' }))
    ok('admin sees problems', cs2?.length >= 1)
    expectErr('admin cannot suspend self', await admin.rpc('admin_set_user_status', { p_user:A, p_status:'suspended', p_reason:'x' }))
    expectErr('admin rejects a bad status value', await admin.rpc('admin_set_user_status', { p_user:S, p_status:'deleted', p_reason:'x' }))
    must('admin hides reported resource', await admin.rpc('admin_resolve_report', { p_report:rep.id, p_action:'actioned', p_effect:'hide_content', p_note:'E2E' }))
    const hidden = await seeker.from('resources').select('id').eq('id', res.id)
    ok('hidden resource not visible to others', !hidden.error && hidden.data.length === 0)
    const ownerView = await solver.from('resources').select('hidden_by_admin').eq('id', res.id).single()
    ok('owner still sees it, flagged hidden', ownerView.data?.hidden_by_admin === true)
    expectErr('owner cannot un-hide it', await solver.from('resources').update({ hidden_by_admin:false }).eq('id', res.id))
    expectErr('already-resolved report cannot be resolved twice', await admin.rpc('admin_resolve_report', { p_report:rep.id, p_action:'dismissed', p_effect:'none', p_note:'' }))
    must('admin approves verification', await admin.rpc('admin_review_verification', { p_request:vr.id, p_approve:true, p_level:'id' }))
    const pv2 = must('seeker verification now', await seeker.from('profiles').select('verification').eq('id', S).single())
    ok('verification level applied', pv2?.verification === 'id')
    must('admin suspends seeker', await admin.rpc('admin_set_user_status', { p_user:S, p_status:'suspended', p_reason:'E2E' }))
    const susp = await seeker.from('cases').select('id')
    ok('suspended user sees no problems', !susp.error && susp.data.length === 0)
    expectErr('suspended user cannot act', await seeker.rpc('send_request', { p_case:c3.id, p_solver:V, p_message:'x' }))
    const sp = await seeker.from('profiles').select('status').eq('id', S).single()
    ok('suspended user can still read own status (for the notice screen)', sp.data?.status === 'suspended')
    must('admin restores seeker', await admin.rpc('admin_set_user_status', { p_user:S, p_status:'active', p_reason:'E2E done' }))
    const back = must('seeker works again', await seeker.from('cases').select('id').limit(1))
    ok('restored user sees data', back?.length >= 1)
    const log = must('audit log', await admin.rpc('admin_audit'))
    ok('actions were logged', log?.length >= 4, 'entries=' + log?.length)
    const rawLog = await seeker.from('audit_log').select('id')
    ok('normal user cannot read audit log table', !rawLog.error && rawLog.data.length === 0)
    const nonAdminLog = await solver.rpc('admin_audit')
    ok('non-admin cannot read audit via function', !!nonAdminLog.error)
    must('admin closes case 3', await admin.rpc('admin_close_case', { p_case:c3.id, p_reason:'E2E' }))
    must('admin resets verification', await admin.rpc('admin_set_verification', { p_user:S, p_level:'none' }))
    const cat = must('admin adds a category', await admin.from('categories').insert({ name:'E2E temp category', sort:999 }).select('id').single())
    expectErr('non-admin cannot add category', await seeker.from('categories').insert({ name:'E2E nope', sort:1000 }))
    must('admin removes the category', await admin.from('categories').delete().eq('id', cat.id))
    // clean up: dismiss any E2E reports left open by earlier runs
    const left = (await admin.rpc('admin_reports', { p_status:'open' })).data ?? []
    for (const r of left.filter(r => r.details === 'E2E test report'))
      await admin.rpc('admin_resolve_report', { p_report:r.id, p_action:'dismissed', p_effect:'none', p_note:'E2E cleanup' })
    ok('E2E reports cleaned up', true, 'dismissed ' + left.filter(r => r.details === 'E2E test report').length)
    await admin.auth.signOut()
  }
  await solver.from('resources').delete().eq('id', res.id)
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
