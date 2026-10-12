import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
const root=fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const seed=JSON.parse(fs.readFileSync(root+'/supabase/seed/standard-2571-2573.json'));
const version={...seed.standard_version,id:'version-guide'};
const categories=[],groups=[],topics=[],evidence=[];
function addTopic(t,c,g=null){ const id='topic-'+t.code; topics.push({...t,id,category_id:c,topic_group_id:g,allow_na:true}); (t.evidence??[]).forEach((label,i)=>evidence.push({id:id+'-ev'+i,topic_id:id,label,sort_order:i})); }
seed.categories.forEach(c=>{ const id='category-'+c.code; categories.push({...c,id,standard_version_id:version.id}); (c.topics??[]).forEach(t=>addTopic(t,id)); (c.groups??[]).forEach(g=>{const gid='group-'+g.code;groups.push({...g,id:gid,category_id:id});g.topics.forEach(t=>addTopic(t,id,gid));});});
const facility={id:'facility-guide',name:'หน่วยบริการตัวอย่าง (สำหรับคู่มือ)',code:'00000',district:'ตัวอย่าง',province:'เชียงราย'};
const round={id:'guide-demo',facility_id:facility.id,standard_version_id:version.id,name:'รอบประเมินตัวอย่างสำหรับคู่มือ',survey_date:'2026-10-13',join_code:'DEMO71',status:'in_progress',scoring_mode:'average',created_at:'2026-10-13T00:00:00Z'};
const participant={id:'participant-guide',round_id:round.id,name:'กรรมการตัวอย่าง',role:'evaluator',joined_at:'2026-10-13T00:00:00Z'};
const user={id:'admin-guide',email:'guide@example.invalid',aud:'authenticated',role:'authenticated'};
const data={assessment_rounds:[round],facilities:[facility],standard_versions:[version],categories,topic_groups:groups,topics,topic_evidence_items:evidence,topic_score_items:[],participants:[participant],scores:[],team_scores:[],topic_photos:[],admin_profiles:[{user_id:user.id,first_name:'ผู้ดูแล',last_name:'ตัวอย่าง'}]};
const browser=await chromium.launch({...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),headless:true});
const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.includes('/storage/')) return route.continue();
 if(url.pathname.includes('/auth/')) return route.fulfill({json:url.pathname.endsWith('/user')?user:{}});
 if(url.pathname.includes('/rpc/is_admin')) return route.fulfill({json:true});
 if(!url.pathname.includes('/rest/')) return route.abort();
 if(req.method()!=='GET'){throw new Error('Screenshot generator forbids database writes');}
 const table=url.pathname.split('/').pop(); const rows=data[table]??[];
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');
 return route.fulfill({json:single?(rows[0]??null):rows});
});
await context.addInitScript(({round,participant})=>localStorage.setItem('pcu_participant_'+round.id,JSON.stringify({participantId:participant.id,roundId:round.id,name:participant.name,role:participant.role})),{round,participant});
const page=await context.newPage(); page.on('pageerror',err=>console.log('PAGE ERROR',err.message));
const base='http://127.0.0.1:5173/pcustandard71';
async function go(path){await page.goto(base+path);await page.waitForTimeout(1200);await page.evaluate(()=>document.fonts.ready);}
async function mark(locator,n){const box=await locator.boundingBox();if(!box)throw new Error('No visible target '+n);await page.evaluate(({box,n})=>{const el=document.createElement('span');el.dataset.guideMarker='';el.textContent=n;Object.assign(el.style,{position:'absolute',left:(box.x+scrollX+Math.min(box.width-22,22))+'px',top:(box.y+scrollY-16)+'px',width:'38px',height:'38px',border:'4px solid #b91c1c',borderRadius:'50%',background:'white',color:'#b91c1c',font:'bold 24px Arial',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,boxShadow:'0 1px 4px #fff',pointerEvents:'none'});document.body.append(el);},{box,n});}
async function shot(name){await page.screenshot({path:root+'/public/guide/'+name+'.png'});await page.locator('[data-guide-marker]').evaluateAll(els=>els.forEach(e=>e.remove())); console.log('Captured '+name);}
await page.setViewportSize({width:540,height:1100});await go('/join');
await page.getByPlaceholder('เช่น A7K3ZQ').fill('DEMO71');
await mark(page.getByPlaceholder('เช่น A7K3ZQ'),1);await mark(page.getByPlaceholder('ชื่อ-สกุลผู้ประเมิน'),2);await mark(page.getByRole('button',{name:'กรรมการประเมิน',exact:true}),3);await mark(page.getByRole('button',{name:'เข้าร่วม',exact:true}),4);await shot('join');
await page.setViewportSize({width:1100,height:900});await go('/round/guide-demo/score');
await page.getByText(round.name,{exact:true}).waitFor();
await mark(page.getByRole('button',{name:/หมวด 1/}),1);
await mark(page.getByRole('button').filter({hasText:topics[0].name_th}).first(),2);
await mark(page.getByText('0/'+topics.length+' หัวข้อ',{exact:true}),3);await shot('score');
await page.getByRole('button').filter({hasText:topics[0].name_th}).first().click();
const pass=page.getByRole('button',{name:'✓ ผ่าน',exact:true}).first();await pass.scrollIntoViewIfNeeded();
await mark(pass,1);await mark(page.getByRole('button',{name:'1',exact:true}).first(),2);await mark(page.locator('textarea').last(),3);await shot('rating');
await go('/round/guide-demo/report');await page.getByRole('button',{name:'Excel (CSV)'}).waitFor();
await mark(page.getByRole('button',{name:'PDF',exact:true}).first(),2);await mark(page.getByRole('button',{name:'ดูในหน้าเว็บ',exact:true}),3);await mark(page.getByText(round.name,{exact:true}),1);await shot('report');
// Local-only simulated admin session, with every API request intercepted above.
await page.evaluate(({user})=>{const payload=btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id,aud:'authenticated'}));const token='eyJhbGciOiJIUzI1NiJ9.'+payload+'.guide';localStorage.setItem('sb-bubozdwvczefprxduaak-auth-token',JSON.stringify({access_token:token,refresh_token:'guide',expires_at:Math.floor(Date.now()/1000)+3600,user,token_type:'bearer'}));},{user});
await go('/admin/rounds/new');await page.getByRole('button',{name:'สร้างรอบการประเมิน',exact:true}).waitFor();
await page.locator('select').first().selectOption(facility.id);await page.getByPlaceholder('เช่น รอบ Presurvey กันยายน 2569').fill(round.name);
await mark(page.getByRole('link',{name:'รอบการประเมิน',exact:true}),1);await mark(page.locator('select').first(),2);await mark(page.getByRole('button').filter({hasText:'ค่าเฉลี่ยกรรมการทุกคน'}),3);await mark(page.getByRole('button',{name:'สร้างรอบการประเมิน',exact:true}),4);await shot('admin');
await browser.close();
