const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {createBackend,hash}=require('./backend.cjs');
const serve=require('../tools/preview.cjs');
const runDatabaseTests=require('./database.cjs');
const output=path.resolve(__dirname,'..','.test-output');

async function main(){
  await runDatabaseTests();
  fs.mkdirSync(output,{recursive:true});
  const sdkPath=path.join(output,'supabase.js');
  if(!fs.existsSync(sdkPath)){
    const response=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2');
    assert.ok(response.ok);fs.writeFileSync(sdkPath,await response.text());
  }
  const sdk=fs.readFileSync(sdkPath,'utf8');
  const backend=await createBackend();
  const server=http.createServer(serve);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL||'chrome'});
  const errors=[];
  const tokenA=crypto.randomUUID(),tokenB=crypto.randomUUID();
  const fixtureToken=crypto.randomUUID();
  const names=[['Facu','Ramiro',"D'Angelo",'Cachete','Esteban','Augusto','Nico','Gonza','Gasti','','Tomi'],['Mati','Emi','Wuerich','Jere','Juan','Marcos','Drazen','Tomás','Santi','El Matador','Nacho']];
  const fixture=(t,i,n)=>backend.db.query('update players set name=$1,owner=$2,player_id=$3 where team=$4 and pos=$5',[n,hash(fixtureToken),crypto.randomUUID(),t,i]);
  for(let t=0;t<2;t++)for(let i=0;i<11;i++)if(names[t][i])await fixture(t,i,names[t][i]);
  for(const [t,i,n] of [[0,11,'Fede'],[0,12,'Fran'],[1,11,'Leo'],[1,12,'Lucas'],[2,0,'Pablo']])await fixture(t,i,n);
  const rpcRequests=[];
  const imageBuffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8iQAAAAASUVORK5CYII=','base64');
  async function context(token,viewport={width:1440,height:1080}){
    const context=await browser.newContext({viewport});
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
    await context.addInitScript(token=>{if(!localStorage.getItem('f11tok'))localStorage.setItem('f11tok',token)},token);
    await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'text/javascript',body:sdk}));
    // Nunca contactar ni escribir en la base de producción durante las pruebas.
    await context.route('https://xeukyzwstqbaciugubtf.supabase.co/**',async route=>{
      const req=route.request(),url=new URL(req.url()),token=req.headers()['x-owner'];
      const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
      if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return}
      try{
        let rows;
        if(url.pathname.startsWith('/rest/v1/rpc/')){
          const name=url.pathname.split('/').at(-1),args=req.postDataJSON();rpcRequests.push({name,args});
          if(backend.failRpc){await route.fulfill({status:404,headers,json:{code:'PGRST202',message:'Missing migration'}});return}
          rows=backend.emptyRpc?[]:await backend.rpc(name,args,token);
        }else if(url.pathname==='/rest/v1/players'){
          assert.equal(req.method(),'GET');backend.reads++;
          rows=await backend.run(async()=> (await backend.db.query('select * from players order by team,pos')).rows);
        }else if(url.pathname==='/rest/v1/bets'){
          if(req.method()==='DELETE'){
            if(backend.failDelete){await route.fulfill({status:403,headers,json:{code:'42501',message:'Denied'}});return}
            const id=url.searchParams.get('id')?.slice(3),owner=url.searchParams.get('owner')?.slice(3);
            rows=(await backend.asOwner(token,d=>d.query('delete from bets where id=$1 and owner=$2 returning *',[id,owner]))).rows;
          }else{
            assert.equal(req.method(),'GET');
            rows=await backend.run(async()=>(await backend.db.query('select * from bets order by created_at desc')).rows);
          }
        }else if(url.pathname==='/rest/v1/chat_messages'){
          if(req.method()==='POST'){
            const m=req.postDataJSON();
            rows=(await backend.asOwner(token,d=>d.query('insert into chat_messages(id,author,team,photo,text,owner) values($1,$2,$3,$4,$5,$6) returning *',[m.id,m.author,m.team,m.photo,m.text,m.owner]))).rows;
          }else if(req.method()==='DELETE'){
            const id=url.searchParams.get('id')?.slice(3);
            rows=(await backend.run(async()=>(await backend.db.query('delete from chat_messages where id=$1 returning *',[id])).rows));
          }else{
            rows=await backend.run(async()=>(await backend.db.query('select * from chat_messages order by created_at desc limit 50')).rows);
          }
        }else if(url.pathname.startsWith('/storage/v1/object/public/')){
          await route.fulfill({status:200,headers,contentType:'image/png',body:imageBuffer});return;
        }else if(url.pathname.startsWith('/storage/v1/object/fotos/')){
          if(backend.failStorage){await route.fulfill({status:403,headers,json:{message:'Upload denied'}});return}
          await route.fulfill({status:200,headers,json:{Key:url.pathname.split('/storage/v1/object/')[1]}});return;
        }else{
          await route.fulfill({status:200,headers,json:{}});return;
        }
        if(url.pathname==='/rest/v1/players'&&backend.holdPlayers){
          const hold=backend.holdPlayers;backend.holdPlayers=null;hold.captured();await hold.wait;
        }
        await route.fulfill({status:200,headers,json:rows});
      }catch(error){await route.fulfill({status:400,headers,json:{code:error.code||'P0001',message:error.message}})}
    });
    await context.route('https://**/*',async route=>{
      const host=new URL(route.request().url()).hostname;
      if(host==='cdn.jsdelivr.net'||host==='xeukyzwstqbaciugubtf.supabase.co')await route.fallback();
      else await route.abort();
    });
    await context.routeWebSocket('**/realtime/v1/**',()=>{});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async dialog=>dialog.accept());
    await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Al día');
    return {context,page};
  }
  async function refresh(page){await page.locator('#sync-status').click();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Al día')}
  async function checkWidth(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false,'No page scroll')}
  // Sin scroll: la cancha es su propia pantalla. En escritorio, tocar un jugador muestra sus stats y "Ver carta" abre la ficha.
  async function toSquad(page){if(!await page.locator('#plantilla').evaluate(e=>e.classList.contains('active')))await page.locator('#tile-teams').click()}
  async function openSlot(page,locator){
    await toSquad(page);await locator.click();
    await page.locator('#dlg').waitFor({state:'visible'});
    // Una carta ocupada abre en modo ficha; "Editar mi carta" pasa al formulario.
    if(await page.locator('#insp-open').isVisible())await page.locator('#insp-open').click();
  }
  async function openPlayer(page,t,i){await openSlot(page,page.locator(`#pitch [data-slot="${t}_${i}"]`))}
  const slotName=(page,t,i)=>page.locator(`#pitch [data-slot="${t}_${i}"]`).getAttribute('aria-label');
  async function waitSaved(page){await page.waitForFunction(()=>!document.querySelector('#dlg').open)}
  try{
    const a=await context(tokenA),b=await context(tokenB);const page=a.page,other=b.page;
    assert.equal(await page.locator('dialog:visible').count(),0,'Closed dialogs are invisible');
    assert.equal(await page.locator('#tile-teams em').textContent(),'Queda 1 lugar en cancha');
    await checkWidth(page);
    await page.screenshot({path:path.join(output,'desktop-home.png')});
    await toSquad(page);await page.waitForTimeout(900);await checkWidth(page);
    await page.screenshot({path:path.join(output,'desktop.png')});
    await openPlayer(page,0,2);
    assert.equal(await page.locator('#dlg .pm-name').textContent(),"D'Angelo");
    assert.equal(await page.locator('#insp-open').count()+await page.locator('#inp').count(),0,'Another access cannot edit a player');
    await page.locator('#cls').click();
    await openPlayer(page,0,9);await page.locator('#inp').fill('Ivo');
    // Error de esquema y respuesta vacía: conservar formulario y datos anteriores.
    backend.failRpc=true;await page.locator('#save').click();
    await page.waitForFunction(()=>document.querySelector('#player-error').textContent.includes('Supabase'));
    assert.equal(await page.locator('#dlg').isVisible(),true);assert.equal(await page.locator('#inp').inputValue(),'Ivo');
    backend.failRpc=false;backend.emptyRpc=true;await page.locator('#save').click();
    await page.waitForFunction(()=>document.querySelector('#player-error').textContent.includes('no confirmó'));
    backend.emptyRpc=false;
    // Subida fallida: no se envía el guardado de jugador y la foto sigue en el formulario.
    const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c7ea6f"/></svg>');
    await page.locator('#file').setInputFiles({name:'avatar.svg',mimeType:'image/svg+xml',buffer:svg});
    await page.waitForFunction(()=>!document.querySelector('#save').disabled);
    const calls=rpcRequests.length;backend.failStorage=true;await page.locator('#save').click();
    await page.waitForFunction(()=>document.querySelector('#player-error').textContent.includes('subir la foto'));
    assert.equal(rpcRequests.length,calls);backend.failStorage=false;
    await page.locator('#save').click();await waitSaved(page);await refresh(other);
    await toSquad(other);assert.equal(await other.locator('#pitch [data-slot="0_9"] .fut-name').textContent(),'Ivo');
    assert.ok((await other.locator('#pitch [data-slot="0_9"] .fut-photo').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('/fotos/'),'Uploaded photo visible in another browser');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Al día');
    await openPlayer(page,0,9);await page.locator('#inp').fill("Ivo D'Angelo");await page.locator('#save').click();await waitSaved(page);
    // Apuestas: arrancar, elegir ganador, premios tocando cartas (hasta 3) y fichas.
    const pick=(pg,name)=>pg.locator(`.award-card[data-player="${name}"]`).click();
    await page.locator('#btn-bets').click();await page.locator('#bet-start').click();
    await page.locator('.win-btn.t0').click();await page.locator('#bet-next').click();
    await page.locator('[data-cat="scorer"]').click();await pick(page,"Ivo D'Angelo");
    await page.locator('[data-cat="mvp"]').click();await pick(page,"D'Angelo");
    await page.locator('[data-cat="keeper"]').click();await pick(page,'Mati');
    assert.equal(await page.locator('#ticket-keeper').textContent(),'Mati');
    await pick(page,'Mati');assert.equal(await page.locator('#ticket-keeper').textContent(),'Cualquiera');
    for(const n of ['Mati','Facu','Ramiro','Cachete'])await pick(page,n);
    assert.equal(await page.locator('#ticket-keeper').textContent(),'Mati, Facu, Ramiro','At most 3 players per award');
    await pick(page,'Facu');await pick(page,'Ramiro');
    await page.locator('#bet-next').click();
    await page.locator('#bet-inp-user').fill('Ivo');await page.locator('#bet-btn-submit').click();
    await page.waitForFunction(()=>document.querySelector('#bet-feedback').classList.contains('success'));
    assert.equal(await page.locator('#bets-count').textContent(),'1');
    await page.locator('#bet-start').click();
    await page.locator('.score-team.t2 .score-btn').last().click();await page.locator('.score-team.t2 .score-btn').last().click();
    await page.locator('#bet-next').click();await page.locator('#bet-next').click();await page.locator('#bet-btn-submit').click();
    await page.waitForFunction(()=>document.querySelector('#bet-feedback').classList.contains('success'));
    assert.equal((await backend.db.query('select count(*)::int as n from bets')).rows[0].n,1);
    await page.locator('#bets-cls').click();await refresh(other);
    await other.locator('#btn-bets').click();assert.equal(await other.locator('#bets-count').textContent(),'1');
    // El mismo nombre en otro acceso no habilita borrar ni reemplaza esa boleta.
    assert.equal(await other.locator('.bet-del').count(),0);
    await other.locator('#bet-start').click();await other.locator('#bet-next').click();await other.locator('#bet-next').click();
    await other.locator('#bet-inp-user').fill('Ivo');await other.locator('#bet-btn-submit').click();await other.waitForFunction(()=>document.querySelector('#bet-feedback').classList.contains('success'));
    assert.equal((await backend.db.query('select count(*)::int as n from bets')).rows[0].n,2);await other.locator('#bets-cls').click();
    await refresh(page);await page.locator('#btn-bets').click();await page.locator('#bet-start').click();
    assert.equal(await page.locator('#score-val-1').textContent(),'2','Saved exact score survives reopen');
    await page.locator('.bet-wizard .btn-close').click();await page.locator('#bets-cls').click();
    // Renombre y movimiento conservan el voto por ID, capitanía y foto.
    await openPlayer(page,0,9);await page.locator('#inp').fill('Ivo actualizado');await page.locator('#mv').selectOption('0_13');await page.locator('#save').click();await waitSaved(page);
    await page.locator('#btn-bets').click();assert.equal(await page.locator('#ticket-scorer').textContent(),'Ivo actualizado');await page.locator('#bets-cls').click();
    assert.equal((await backend.db.query('select name from players where team=0 and pos=9')).rows[0].name,'');
    await refresh(other);assert.equal(await other.locator('#bench-t0 .b-slot-nm').filter({hasText:'Ivo actualizado'}).count(),1);
    // Una lectura vieja que termina después del guardado no pisa la confirmación nueva.
    let release,captured;
    const snapshotCaptured=new Promise(resolve=>captured=resolve);
    backend.holdPlayers={captured,wait:new Promise(resolve=>release=resolve)};
    const oldSync=page.evaluate(()=>sync());await snapshotCaptured;
    await openSlot(page,page.locator('#bench-t0 .b-slot').filter({hasText:'Ivo actualizado'}));
    await page.locator('#inp').fill('Ivo final');await page.locator('#save').click();await waitSaved(page);
    release();await oldSync;
    assert.equal(await page.locator('#bench-t0 .b-slot-nm').filter({hasText:'Ivo final'}).count(),1);
    // Volver al nombre utilizado por las comprobaciones siguientes.
    await openSlot(page,page.locator('#bench-t0 .b-slot').filter({hasText:'Ivo final'}));await page.locator('#inp').fill('Ivo actualizado');await page.locator('#save').click();await waitSaved(page);
    // Broadcast con payload anidado hace una lectura; datos no confirmados no se aplican.
    const reads=backend.reads;
    await other.evaluate(()=>handleLiveNotice({event:'player_extra',payload:{row:{team:0,pos:9,name:'Falso'}}}));
    await other.waitForFunction(()=>document.querySelector('#tile-teams em').textContent==='Queda 1 lugar en cancha');
    await new Promise(resolve=>setTimeout(resolve,250));assert.ok(backend.reads>reads);
    assert.ok((await slotName(other,0,9)).endsWith('lugar libre'),'Unconfirmed broadcast data is not shown');
    // Recuperar el mismo acceso permite editar en un tercer navegador.
    const recovered=await context(tokenA,{width:390,height:844});const mobile=recovered.page;
    await openSlot(mobile,mobile.locator('#bench-t0 .b-slot').filter({hasText:'Ivo actualizado'}));
    assert.equal(await mobile.locator('#inp').isDisabled(),false,'The same access can edit on another device');await mobile.locator('#cls').click();
    await checkWidth(mobile);await mobile.screenshot({path:path.join(output,'mobile.png')});
    await mobile.locator('#btn-bets').click();await checkWidth(mobile);
    await mobile.screenshot({path:path.join(output,'mobile-prode.png')});await mobile.locator('#bets-cls').click();
    // Chat confirmado y sincronizado, con caracteres que antes podían inyectar HTML.
    await mobile.locator('#btn-chat').click();if(await mobile.locator('.wa-name-chip').isVisible())await mobile.locator('.wa-name-chip').click();await mobile.locator('#chat-inp-name').fill('<b>Ivo</b>');await mobile.locator('#chat-inp-msg').fill('Nos vemos a las 16:45 ⚽');await mobile.locator('#chat-send').click();
    await mobile.waitForFunction(()=>document.querySelectorAll('.chat-item').length===1);
    await mobile.locator('#chat-cls').click();await refresh(other);await other.locator('#btn-chat').click();assert.equal(await other.locator('.chat-item-text').textContent(),'Nos vemos a las 16:45 ⚽');
    assert.equal(await other.locator('.chat-item-user').textContent(),'<b>Ivo</b>','Names render as text, not HTML');await other.locator('#chat-cls').click();
    // Borrado fallido conserva la boleta; un borrado confirmado quita solo la propia.
    await refresh(page);await page.locator('#btn-bets').click();backend.failDelete=true;
    await page.locator('.bet-del').click();await page.waitForFunction(()=>document.querySelector('#bet-feedback').textContent.includes('permiso'));
    assert.equal(await page.locator('#bets-count').textContent(),'2');backend.failDelete=false;
    await page.locator('.bet-del').click();await page.waitForFunction(()=>document.querySelector('#bets-count').textContent==='1');
    assert.equal((await backend.db.query('select owner from bets')).rows[0].owner,hash(tokenB));await page.locator('#bets-cls').click();
    // Sin internet no se confirma ni se conserva un guardado solo en este navegador.
    await a.context.setOffline(true);await openPlayer(page,0,9);await page.locator('#inp').fill('Sin internet');await page.locator('#save').click();
    await page.waitForFunction(()=>!!document.querySelector('#player-error').textContent);
    assert.equal((await backend.db.query('select name from players where team=0 and pos=9')).rows[0].name,'');
    await page.locator('#cls').click();await a.context.setOffline(false);await refresh(page);
    // Lista vacía del servidor limpia la caché: no reaparecen boletas borradas.
    await backend.db.exec('delete from bets');await refresh(page);await page.locator('#btn-bets').click();assert.equal(await page.locator('#bets-count').textContent(),'0');await page.locator('#bets-cls').click();
    await page.reload();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Al día');assert.equal(await page.locator('#bets-badge').textContent(),'0');
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:900});await checkWidth(page);
      await page.locator('#btn-bets').click();
      assert.equal(await page.locator('#dlg-bets').evaluate(e=>e.scrollWidth>e.clientWidth),false,'Prode fits the dialog');
      await page.locator('#bets-cls').click();
    }
    assert.deepEqual(errors,[],'No browser exceptions');
    console.log('Browser: two independent accesses, persistence, photos, errors, bet wizard (max 3 per award), IDs, broadcast, chat and responsive layout passed.');
    console.log('Screenshots: .test-output/desktop-home.png, desktop.png, mobile.png, mobile-prode.png');
  }finally{
    await browser.close();await backend.db.close();await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
