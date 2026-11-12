const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createBackend,hash}=require('./backend.cjs');

async function runDatabaseTests(){
  const backend=await createBackend(),{db,rpc}=backend;
  const tokenA=crypto.randomUUID(),tokenB=crypto.randomUUID();
  const player=(team,pos,name,extra={})=>rpc('save_centenario_player',{
    source_team:team,source_pos:pos,target_team:team,target_pos:pos,player_name:name,player_photo:null,captain:false,...extra
  },tokenA);
  try{
    await player(0,0,"D'Angelo",{captain:true});
    let original=(await db.query('select * from players where team=0 and pos=0')).rows[0];
    assert.equal(original.owner,hash(tokenA));assert.ok(original.player_id);
    await db.exec(backend.migration);
    assert.deepEqual((await db.query('select * from players where team=0 and pos=0')).rows[0],original,'Migration preserves players and owners');
    await player(0,0,'Ivo nuevo',{player_photo:'https://example.com/foto.jpg'});
    assert.equal((await db.query('select * from players where team=0 and pos=0')).rows[0].player_id,original.player_id,'Rename preserves ID');
    await assert.rejects(()=>rpc('save_centenario_player',{source_team:0,source_pos:0,target_team:0,target_pos:0,player_name:'Ajeno',player_photo:null,captain:false},tokenB),/otro acceso/);
    await player(0,0,'Ivo nuevo',{target_team:1,target_pos:9,captain:true});
    assert.equal((await db.query('select name from players where team=0 and pos=0')).rows[0].name,'','Move releases source');
    assert.equal((await db.query('select player_id from players where team=1 and pos=9')).rows[0].player_id,original.player_id);
    await player(1,1,'Otro capitán',{captain:true});
    assert.equal((await db.query('select count(*)::int as n from players where team=1 and is_captain')).rows[0].n,1);
    await player(0,11,'Suplente');await player(2,0,'Árbitro');
    await player(0,16,'El Profe');
    assert.equal((await db.query('select name from players where team=0 and pos=16')).rows[0].name,'El Profe','Coach slot exists');
    await assert.rejects(()=>player(0,16,'El Profe',{target_team:0,target_pos:5}),/técnico/);
    await assert.rejects(()=>backend.asOwner(tokenB,d=>d.query("update players set name='intruso' where team=2 and pos=0")),/permission denied/);
    // Simular lugares antiguos sin propietario: el primer guardado los reclama.
    await db.query("update players set name='Sin acceso',owner=null where team=0 and pos=3");
    await player(0,3,'Recuperado');
    assert.equal((await db.query('select owner from players where team=0 and pos=3')).rows[0].owner,hash(tokenA));
    const betId=crypto.randomUUID();
    const bet={bet_id:betId,user_label:'Ivo',prediction:JSON.stringify({s0:3,s1:1,mvp:'Ivo nuevo',refs:{mvp:original.player_id}}),goals:'mas',scorer_name:'',yellow_name:'',chips:500};
    await rpc('save_centenario_bet',bet,tokenA);
    await rpc('save_centenario_bet',{...bet,prediction:JSON.stringify({s0:0,s1:0}),chips:250},tokenA);
    assert.equal((await db.query('select count(*)::int as n from bets')).rows[0].n,1,'Replacement persists exactly once');
    await assert.rejects(()=>rpc('save_centenario_bet',{...bet,chips:7},tokenA),/fichas/);
    assert.equal((await db.query('select amount from bets')).rows[0].amount,250,'Failed replacement preserves previous bet');
    await assert.rejects(()=>rpc('save_centenario_bet',bet,tokenB),/otro acceso/);
    const otherBet=crypto.randomUUID();
    await rpc('save_centenario_bet',{...bet,bet_id:otherBet},tokenB);
    assert.equal((await db.query('select count(*)::int as n from bets')).rows[0].n,2,'Same name can belong to two separate accesses');
    assert.equal((await backend.asOwner(tokenB,d=>d.query('delete from bets where id=$1 returning *',[betId]))).rows.length,0,'RLS protects another bet');
    assert.equal((await backend.asOwner(tokenA,d=>d.query('delete from bets where id=$1 returning *',[betId]))).rows.length,1);
    await assert.rejects(()=>backend.asOwner(tokenA,d=>d.query("insert into chat_messages(id,author,text,image,owner) values(gen_random_uuid(),'Ivo','foto','javascript:alert(1)',$1)",[hash(tokenA)])),/chat_messages_image_check/);
    await backend.asOwner(tokenA,d=>d.query("insert into chat_messages(id,author,text,image,owner) values(gen_random_uuid(),'Ivo','📷','https://example.com/f.jpg',$1)",[hash(tokenA)]));
    await db.exec("delete from chat_messages");
    const chatId=crypto.randomUUID();
    await backend.asOwner(tokenA,d=>d.query('insert into chat_messages(id,author,text,owner) values($1,$2,$3,$4)',[chatId,'Ivo','Llegamos a las 16:45',hash(tokenB)]));
    assert.equal((await db.query('select owner from chat_messages where id=$1',[chatId])).rows[0].owner,hash(tokenA),'Chat stamps real owner');
    assert.equal((await backend.asOwner(tokenB,d=>d.query('delete from chat_messages where id=$1 returning *',[chatId]))).rows.length,0);
    await assert.rejects(()=>rpc('admin_delete_chat_message',{msg_id:chatId,admin_pass:'incorrecta'},tokenB),/Contraseña de administrador incorrecta/);
    await rpc('admin_delete_chat_message',{msg_id:chatId,admin_pass:'centenarioutn412'},tokenB);
    assert.equal((await db.query('select count(*)::int as n from chat_messages where id=$1',[chatId])).rows[0].n,0,'Admin deleted chat message');
    await assert.rejects(()=>rpc('save_centenario_bet',bet,''),/Acceso inválido/);

    // El admin puede renombrar y mover un jugador ajeno sin ser su dueño.
    await rpc('save_centenario_player',{
      source_team:1,source_pos:2,target_team:1,target_pos:2,player_name:'Jugador de B',player_photo:null,captain:false
    },tokenB);
    await assert.rejects(()=>rpc('admin_save_centenario_player',{
      admin_pass:'incorrecta',source_team:1,source_pos:2,target_team:1,target_pos:2,player_name:'Hackeado',player_photo:null,captain:false
    },tokenA),/Contraseña de administrador incorrecta/);
    await rpc('admin_save_centenario_player',{
      admin_pass:'centenarioutn412',source_team:1,source_pos:2,target_team:1,target_pos:2,player_name:'Renombrado por admin',player_photo:null,captain:false
    },tokenA);
    let afterRename=(await db.query('select * from players where team=1 and pos=2')).rows[0];
    assert.equal(afterRename.name,'Renombrado por admin');
    assert.equal(afterRename.owner,hash(tokenB),'Admin rename keeps original owner');
    await rpc('admin_save_centenario_player',{
      admin_pass:'centenarioutn412',source_team:1,source_pos:2,target_team:1,target_pos:3,player_name:'Movido por admin',player_photo:null,captain:false
    },tokenA);
    assert.equal((await db.query('select name from players where team=1 and pos=2')).rows[0].name,'','Admin move releases source slot');
    const afterMove=(await db.query('select * from players where team=1 and pos=3')).rows[0];
    assert.equal(afterMove.name,'Movido por admin');
    assert.equal(afterMove.owner,hash(tokenB),'Admin move keeps original owner');

    console.log('Database: migrations, ownership, atomic moves, captain, IDs, bets, rollback, chat and admin edits passed.');
  }finally{await db.close()}
}
module.exports=runDatabaseTests;
if(require.main===module)runDatabaseTests().catch(error=>{console.error(error);process.exitCode=1});
