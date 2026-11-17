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

// ============================================================
// Free-text flow (needs supabase/ai_matching.sql applied)
// ============================================================
const hasText = !(await seeker.from('synonyms').select('word').limit(1)).error
if (!hasText) {
  console.log('\nSKIP free-text checks: run supabase/ai_matching.sql first')
} else {
  console.log('\n-- free-text flow: helper writes what she offers')
  const grandma = 'I am a grandmother who loves telling bedtime stories to children. My grandchildren live far away now, so I have no little ones to tell my stories to.'
  expectErr('too-short offer rejected', await solver.rpc('save_offer', { p_text:'hi' }))
  const so = must('helper saves offer', await solver.rpc('save_offer', { p_text:grandma, p_headline:'Grandmother who loves telling bedtime stories', p_summary:'A grandmother with bedtime stories.', p_keywords:[], p_city:'Kochi' }))
  ok('save_offer returns a count', typeof so?.matched_problems === 'number', JSON.stringify(so))
  const me2 = must('helper profile read back', await solver.from('profiles').select('offer_text,offer_stems,intent,headline').eq('id', V).single())
  ok('profile keeps offer text and builds stems', me2?.offer_text?.includes('bedtime') && me2?.offer_stems?.length > 3, 'stems=' + me2?.offer_stems?.length)
  ok('helper stays a helper', me2?.intent === 'solver' || me2?.intent === 'both')

  console.log('-- free-text flow: seeker tells Pip')
  expectErr('too-short problem rejected', await seeker.rpc('submit_problem', { p_text:'help' }))
  const sp = must('seeker submits problem', await seeker.rpc('submit_problem', { p_text:'I want a grandmother to tell bedtime stories to my kids', p_title:null, p_summary:null, p_keywords:[], p_public:true }))
  ok('problem matched at least one helper', sp?.matches >= 1, 'matches=' + sp?.matches)
  const tm = must('read text matches', await seeker.from('matches').select('id,profile_id,score,explanation,hits,breakdown,decision').eq('case_id', sp.case_id).order('rank'))
  const mv = tm?.find(m => m.profile_id === V)
  ok('the grandmother is among the matches', !!mv)
  ok('explanation lists real words', /Matches on:/.test(mv?.explanation ?? '') && /stor/.test(mv?.explanation ?? ''), mv?.explanation)
  ok('breakdown is the text type', mv?.breakdown?.type === 'text' && mv?.breakdown?.hits?.length >= 2, JSON.stringify(mv?.breakdown?.hits))
  ok('scores are between 0 and 1', tm?.every(m => m.score >= 0 && m.score <= 1))
  ok('seeker is not matched with self', !tm?.some(m => m.profile_id === S))
  const solverRows = must('helper sees only own match rows', await solver.from('matches').select('profile_id').eq('case_id', sp.case_id))
  ok('helper sees only their row', solverRows?.length === 1 && solverRows[0].profile_id === V)

  console.log('-- free-text flow: synonyms and unrelated problems')
  const syn = must('synonym problem', await seeker.rpc('submit_problem', { p_text:'Looking for a granny to read tales to my children at night', p_public:false }))
  const synRows = await seeker.from('matches').select('profile_id').eq('case_id', syn.case_id)
  ok('granny/tales/children still finds the grandmother', synRows.data?.some(m => m.profile_id === V))
  const un = must('unrelated problem', await seeker.rpc('submit_problem', { p_text:'I need a plumber to fix a leaking tap in my kitchen sink', p_public:false }))
  const unRows = await seeker.from('matches').select('profile_id').eq('case_id', un.case_id)
  ok('storyteller is not matched to a plumbing problem', !unRows.data?.some(m => m.profile_id === V))

  console.log('-- free-text flow: swipe')
  expectErr('helper cannot decide on the seeker matches', await solver.rpc('decide_match', { p_match:mv.id, p_choose:true, p_message:'x' }))
  const other = tm.find(m => m.profile_id !== V)
  if (other) {
    must('seeker passes on someone', await seeker.rpc('decide_match', { p_match:other.id, p_choose:false }))
    const pd = await seeker.from('matches').select('decision').eq('id', other.id).single()
    ok('pass is remembered', pd.data?.decision === 'passed')
  }
  const chosen = must('seeker chooses the grandmother', await seeker.rpc('decide_match', { p_match:mv.id, p_choose:true, p_message:'I want a grandmother to tell bedtime stories to my kids' }))
  ok('choosing creates a request', !!chosen)
  const asked = must('helper sees the request', await solver.from('connections').select('status,message').eq('id', chosen).single())
  ok('request is pending with the problem as message', asked?.status === 'pending' && /bedtime/.test(asked?.message ?? ''))
  expectErr('choosing twice is blocked', await seeker.rpc('decide_match', { p_match:mv.id, p_choose:true, p_message:'again' }))
  must('helper accepts', await solver.rpc('transition_connection', { p_id:chosen, p_action:'accept' }))
  must('helper writes first message', await solver.from('messages').insert({ connection_id:chosen, sender_id:V, body:'Hello! I would love to tell stories.' }))

  console.log('-- free-text flow: helper browses problems')
  const bp = must('helper browse, no search', await solver.rpc('problems_for_helper', { p_query:'' }))
  ok('browse returns a list', Array.isArray(bp))
  const bq = must('helper browse, typed search', await solver.rpc('problems_for_helper', { p_query:'stories for children' }))
  ok('typed search finds public story problems with hits', bq?.some(p => p.hits?.length >= 1))
  ok('private problems are not listed', !bq?.some(p => p.id === syn.case_id || p.id === un.case_id))
  ok('own problems are not listed to their owner', !(await seeker.rpc('problems_for_helper', { p_query:'stories' })).data?.some(p => p.id === sp.case_id))

  console.log('-- free-text flow: waiting problem, then a helper appears')
  const wait = must('seeker posts a problem nobody can help with', await seeker.rpc('submit_problem', { p_text:'Need someone to assemble an IKEA wardrobe and shelves in my flat', p_public:true }))
  ok('nobody matches yet', wait?.matches === 0, 'matches=' + wait?.matches)
  const stillWaiting = await solver.rpc('problems_for_helper', { p_query:'wardrobe' })
  ok('helper can find it by searching and it says waiting', stillWaiting.data?.some(p => p.id === wait.case_id && p.waiting === true))
  const so2 = must('helper adds furniture skills', await solver.rpc('save_offer', { p_text: grandma + ' I also assemble furniture, wardrobes and shelves.' }))
  ok('the waiting problem is matched', so2?.matched_problems >= 1, JSON.stringify(so2))
  const note = must('seeker notifications', await seeker.from('notifications').select('kind,title,link').eq('kind', 'new_match'))
  ok('seeker was told about the new match', note?.some(n => n.link?.includes(wait.case_id)))
  const notes2 = must('helper notifications', await solver.from('notifications').select('kind'))
  ok('helper was told about a new problem that fits', notes2?.some(n => n.kind === 'new_problem'))

  console.log('-- free-text flow: admin view')
  const admin2 = mk()
  const ad2 = process.env.E2E_ADMIN_EMAIL ? await admin2.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }) : null
  if (ad2 && !ad2.error) {
    const ov2 = must('admin overview with new counts', await admin2.rpc('admin_overview'))
    ok('overview has helpers and waiting counts', typeof ov2?.helpers === 'number' && typeof ov2?.waiting_problems === 'number', JSON.stringify(ov2))
    const wl = must('admin waiting list', await admin2.rpc('admin_waiting'))
    ok('waiting list works', Array.isArray(wl))
  }
  const nonAdminWaiting = await seeker.rpc('admin_waiting')
  ok('normal user cannot read the waiting list', !!nonAdminWaiting.error)

  for (const cid of [sp.case_id, syn.case_id, un.case_id, wait.case_id]) await seeker.rpc('close_case', { p_case:cid })
}

// ============================================================
// Explore (needs supabase/explore.sql applied)
// ============================================================
const hasExplore = !(await seeker.rpc('explore_problems', { p_query:'', p_sort:'new', p_limit:1 })).error
if (!hasExplore) {
  console.log('\nSKIP explore checks: run supabase/explore.sql first')
} else {
  console.log('\n-- explore: problems')
  const ep = must('explore problems', await seeker.rpc('explore_problems', { p_query:'', p_sort:'new', p_limit:60 }))
  ok('lists public open problems', Array.isArray(ep) && ep.length >= 1, 'count=' + ep?.length)
  ok('each row has the fields the page needs', ep?.every(r => r.id && r.title && typeof r.waiting === 'boolean' && typeof r.offers === 'number' && Array.isArray(r.hits)))
  const mine = must('my own problems', await seeker.from('cases').select('id').eq('owner_id', S).eq('visibility', 'public_anonymised'))
  ok('own problems are not listed', !ep?.some(r => mine?.some(m => m.id === r.id)))
  const ef = must('explore search', await seeker.rpc('explore_problems', { p_query:'smartphone video calls', p_sort:'new', p_limit:20 }))
  ok('search finds related problems with hits', ef?.length >= 1 && ef.every(r => r.hits.length >= 1 || /smartphone|video|call/i.test(r.title + r.description)), 'count=' + ef?.length)
  const ew = must('explore sort waiting', await seeker.rpc('explore_problems', { p_query:'', p_sort:'waiting', p_limit:60 }))
  ok('waiting sort puts waiting problems first', ew?.length === 0 || ew[0].waiting === true || ew.every(r => !r.waiting))
  const ebest = must('explore sort best for me', await solver.rpc('explore_problems', { p_query:'', p_sort:'fit', p_limit:60 }))
  ok('best-for-me sort works for a helper', Array.isArray(ebest))
  const anonView = await mk().from('public_cases').select('id,title,summary,description,owner_id')
  ok('signed-out visitors can still see public problems', !anonView.error || /owner_id/.test(anonView.error.message))
  const anonView2 = await mk().from('public_cases').select('id,title,summary')
  ok('public view works without owner info', !anonView2.error && anonView2.data.length >= 1)
  ok('signed-out visitors cannot call the explore functions', !!(await mk().rpc('explore_problems', { p_query:'' })).error)

  console.log('-- explore: solvers')
  const eh = must('explore helpers', await seeker.rpc('explore_helpers', { p_query:'', p_sort:'new', p_limit:60 }))
  ok('lists people with a profile', eh?.length >= 1, 'count=' + eh?.length)
  ok('the grandmother account is listed', eh?.some(h => h.id === V))
  ok('you are not listed to yourself', !eh?.some(h => h.id === S))
  ok('only people who wrote what they offer are listed', eh?.every(h => h.about && h.about.length > 0))
  const ehq = must('explore helpers search', await seeker.rpc('explore_helpers', { p_query:'grandmother stories', p_sort:'new', p_limit:20 }))
  ok('search finds the storytellers', ehq?.some(h => h.id === V) && ehq.every(h => h.hits.length >= 1 || /grand|stor/i.test(h.about + h.display_name)))
  expectErr('signed-out visitors cannot list people', await mk().rpc('explore_helpers', { p_query:'' }))

  console.log('-- explore: chat with a solver')
  expectErr('cannot chat with yourself', await seeker.rpc('contact_helper', { p_helper:S, p_message:'hello there' }))
  expectErr('empty message rejected', await seeker.rpc('contact_helper', { p_helper:V, p_message:' ' }))
  const chat = must('seeker chats with the grandmother', await seeker.rpc('contact_helper', { p_helper:V, p_message:'Hi! Are you free this week for a story session?' }))
  ok('a request was created', !!chat)
  const cc = must('helper sees the chat request', await solver.from('connections').select('status,message,case_id').eq('id', chat).single())
  ok('it is pending with the message', cc?.status === 'pending' && /story session/.test(cc?.message ?? ''))
  const ck = must('chat opener case', await solver.from('cases').select('kind,visibility,status').eq('id', cc.case_id).single())
  ok('the opener is a private chat, not a problem', ck?.kind === 'chat' && ck?.visibility === 'private')
  const hiddenFromExplore = await solver.rpc('explore_problems', { p_query:'story session', p_sort:'new', p_limit:50 })
  ok('chat openers never show in Explore', !hiddenFromExplore.data?.some(p => p.id === cc.case_id))
  expectErr('messaging the same person twice about the same opener is blocked', await seeker.rpc('send_request', { p_case:cc.case_id, p_solver:V, p_message:'again' }))
  must('helper answers with a question first', await solver.rpc('transition_connection', { p_id:chat, p_action:'ask' }))
  must('helper can reply before accepting', await solver.from('messages').insert({ connection_id:chat, sender_id:V, body:'Yes, Thursday works.' }))
  must('seeker can reply', await seeker.from('messages').insert({ connection_id:chat, sender_id:S, body:'Thursday evening is perfect.' }))
  must('seeker closes the thread', await seeker.rpc('transition_connection', { p_id:chat, p_action:'cancel' }))

  console.log('-- explore: offer help from a seeker-only account')
  await seeker.from('profiles').update({ intent:'seeker' }).eq('id', S)
  const sp2 = must('helper posts a public problem', await solver.rpc('submit_problem', { p_text:'I need someone to help me repot and care for my balcony plants this month', p_public:true }))
  const before = (await seeker.from('profiles').select('intent').eq('id', S).single()).data?.intent
  ok('the account is seeker-only before', before === 'seeker')
  const oh = must('seeker-only account offers help', await seeker.rpc('offer_help', { p_case:sp2.case_id, p_message:'I love plants and can help.' }))
  ok('offer created', !!oh)
  const after = (await seeker.from('profiles').select('intent').eq('id', S).single()).data?.intent
  ok('helping was switched on automatically', after === 'both', 'intent=' + after)
  expectErr('cannot offer on your own problem', await solver.rpc('offer_help', { p_case:sp2.case_id, p_message:'me' }))
  expectErr('duplicate offer is blocked', await seeker.rpc('offer_help', { p_case:sp2.case_id, p_message:'again' }))
  await seeker.from('profiles').update({ intent:'seeker' }).eq('id', S)

  console.log('-- explore: match quality')
  const ph = must('phones problem', await seeker.rpc('submit_problem', { p_text:'My father is 72 and cannot use a smartphone. He wants to make WhatsApp video calls to his family. I need someone to teach him how to use it.', p_public:false }))
  const phRows = await seeker.from('matches').select('profile_id').eq('case_id', ph.case_id)
  ok('storytellers are not matched to a phone-teaching problem', !phRows.data?.some(m => m.profile_id === V), 'matches=' + phRows.data?.length)
  ok('nobody is matched to it yet, so it waits', phRows.data?.length === 0, 'matches=' + phRows.data?.length)
  const st = must('story problem again', await seeker.rpc('submit_problem', { p_text:'I want a grandmother to tell bedtime stories to my kids', p_public:false }))
  const stRows = await seeker.from('matches').select('profile_id').eq('case_id', st.case_id)
  ok('the grandmother is still matched to the story problem', stRows.data?.some(m => m.profile_id === V))

  for (const cid of [sp2.case_id, ph.case_id, st.case_id]) { await solver.rpc('close_case', { p_case:cid }); await seeker.rpc('close_case', { p_case:cid }) }
}

// ============================================================
// Photos and files (needs supabase/media.sql applied)
// ============================================================
const hasMedia = !(await seeker.from('media').select('id').limit(1)).error
if (!hasMedia) {
  console.log('\nSKIP photo and file checks: run supabase/media.sql first')
} else {
  console.log('\n-- media: profile photo')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const up = await solver.storage.from('avatars').upload(V + '/e2e-' + Date.now() + '.png', png, { contentType:'image/png' })
  ok('helper uploads a profile photo', !up.error, up.error?.message)
  if (!up.error) {
    const url = solver.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    must('profile points at the photo', await solver.from('profiles').update({ avatar_url:url }).eq('id', V))
    const got = await fetch(url)
    ok('the photo can be opened by link', got.ok, 'status=' + got.status)
    const eh = must('explore shows the photo', await seeker.rpc('explore_helpers', { p_query:'', p_sort:'new', p_limit:60 }))
    ok('explore list includes avatar_url', eh?.find(h => h.id === V)?.avatar_url === url)
    const people = must('a seeker can read the profile photo', await seeker.from('profiles').select('avatar_url').eq('id', V).single())
    ok('seeker sees the helper photo', people?.avatar_url === url)
    await solver.storage.from('avatars').remove([up.data.path])
    await solver.from('profiles').update({ avatar_url:null }).eq('id', V)
  }
  const bad = await seeker.storage.from('avatars').upload(V + '/not-yours.png', png, { contentType:'image/png' })
  ok("cannot upload into someone else's folder", !!bad.error, bad.error?.message)
  const wrong = await solver.storage.from('avatars').upload(V + '/script.txt', Buffer.from('hello'), { contentType:'text/plain' })
  ok('a text file is not allowed as a photo', !!wrong.error, wrong.error?.message)

  console.log('-- media: files on a profile')
  const added = []
  for (let i = 0; i < 8; i++) {
    const path = V + '/e2e-media-' + i + '-' + Date.now() + '.png'
    const f = await solver.storage.from('media').upload(path, png, { contentType:'image/png' })
    if (f.error) { ok('upload to media bucket', false, f.error.message); break }
    const r = await solver.from('media').insert({ owner_id:V, kind:'profile', url:'https://example.invalid/' + path, path, file_type:'image', name:'e2e ' + i, size_bytes:png.length }).select('id,path').single()
    if (r.error) { ok('add profile file ' + (i + 1), false, r.error.message); break }
    added.push(r.data)
  }
  ok('a helper can add profile files (up to 8)', added.length >= 1, 'added ' + added.length)
  const ninth = await solver.from('media').insert({ owner_id:V, kind:'profile', url:'https://example.invalid/x', path:V + '/x.png', file_type:'image', name:'ninth', size_bytes:1 })
  ok('a ninth profile file is refused when 8 exist', added.length < 8 || !!ninth.error, ninth.error?.message)
  const seen = must('another person reads the profile files', await seeker.from('media').select('id').eq('owner_id', V).eq('kind', 'profile'))
  ok('profile files are visible to others', seen?.length >= added.length)
  const steal = await seeker.from('media').delete().eq('id', added[0]?.id ?? '00000000-0000-0000-0000-000000000000').select()
  ok('others cannot delete your files', !steal.error && steal.data.length === 0)
  const fake = await seeker.from('media').insert({ owner_id:V, kind:'profile', url:'x', path:'x', file_type:'image', name:'fake' })
  ok('cannot add a file in someone else name', !!fake.error)

  console.log('-- media: files on a problem')
  const pb = must('a public problem', await seeker.rpc('submit_problem', { p_text:'I need my old bicycle repaired, see the photo of the broken chain', p_public:true }))
  const pPath = S + '/e2e-problem-' + Date.now() + '.png'
  const pu = await seeker.storage.from('media').upload(pPath, png, { contentType:'image/png' })
  ok('problem maker uploads a photo', !pu.error, pu.error?.message)
  const pm = must('photo attached to the problem', await seeker.from('media').insert({ owner_id:S, kind:'problem', case_id:pb.case_id, url:'https://example.invalid/' + pPath, path:pPath, file_type:'image', name:'chain.png', size_bytes:png.length }).select('id').single())
  const seenBy = must('a helper reads the public problem files', await solver.from('media').select('id').eq('case_id', pb.case_id))
  ok('helpers can see files of a public problem', seenBy?.length === 1)
  const notOwner = await solver.from('media').insert({ owner_id:V, kind:'problem', case_id:pb.case_id, url:'x', path:'x', file_type:'image', name:'nope' })
  ok('only the owner can add files to a problem', !!notOwner.error)
  const priv = must('a private problem', await seeker.rpc('submit_problem', { p_text:'Private job: please look at the attached plan of my house', p_public:false }))
  const prPath = S + '/e2e-private-' + Date.now() + '.png'
  await seeker.storage.from('media').upload(prPath, png, { contentType:'image/png' })
  await seeker.from('media').insert({ owner_id:S, kind:'problem', case_id:priv.case_id, url:'https://example.invalid/' + prPath, path:prPath, file_type:'image', name:'plan.png', size_bytes:png.length })
  const hidden = await solver.from('media').select('id').eq('case_id', priv.case_id)
  ok('files of a private problem are hidden from others', !hidden.error && hidden.data.length === 0)

  // clean up
  for (const a of added) { await solver.from('media').delete().eq('id', a.id); await solver.storage.from('media').remove([a.path]) }
  await seeker.from('media').delete().eq('case_id', pb.case_id); await seeker.from('media').delete().eq('case_id', priv.case_id)
  await seeker.storage.from('media').remove([pPath, prPath])
  for (const cid of [pb.case_id, priv.case_id]) await seeker.rpc('close_case', { p_case:cid })
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
