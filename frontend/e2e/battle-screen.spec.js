import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app.js';
import { perfectIvs } from '../../backend/src/services/ivRules.js';

const { PrismaClient } = createRequire(new URL('../../backend/package.json', import.meta.url))('@prisma/client');
let temporary, db, server, origin, save;
async function post(route, body, selected = save) {
  const response = await fetch(`${origin}/api${route}`, { method:'POST', headers:{'Content-Type':'application/json', ...(selected ? {'X-Save-Id':selected.id} : {})}, body:JSON.stringify(body) });
  expect(response.ok, await response.clone().text()).toBe(true);
  return (await response.json()).data;
}
async function enter(page, route) {
  await page.addInitScript(id=>localStorage.setItem('pokemon-simulator-local-save',JSON.stringify({state:{saveId:id,usuario:{login:'Batalha UI'}},version:0})),save.id);
  await page.goto(origin+route);
}
async function expectFilterRows(page) {
  const controls = ['name', 'type', 'stars', 'level', 'shiny'].map(name => page.locator(`.battle-filter-${name}`));
  for (const control of controls) await expect(control).toBeVisible();
  const [name, type, stars, level, shiny] = await Promise.all(controls.map(control => control.boundingBox()));
  expect(Math.abs(name.y - type.y)).toBeLessThan(1);
  expect(stars.y).toBeGreaterThanOrEqual(name.y + name.height);
  expect(Math.abs(stars.y - level.y)).toBeLessThan(1);
  expect(Math.abs(stars.y - shiny.y)).toBeLessThan(1);
  expect(name.x + name.width).toBeLessThanOrEqual(type.x);
  expect(stars.x + stars.width).toBeLessThanOrEqual(level.x);
  expect(level.x + level.width).toBeLessThanOrEqual(shiny.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
test.beforeAll(async()=>{
  temporary=mkdtempSync(path.join(tmpdir(),'battle-screen-'));
  const file=path.join(temporary,'test.db'),url=`file:${file.replaceAll('\\','/')}`;writeFileSync(file,'');
  for(const name of ['migrate-local.js','seed-moves.js']) {
    const run=spawnSync(process.execPath,[fileURLToPath(new URL(`../../backend/scripts/${name}`,import.meta.url))],{env:{...process.env,DATABASE_URL:url},encoding:'utf8',windowsHide:true});
    expect(run.status,run.stderr || run.stdout).toBe(0);
  }
  db=new PrismaClient({datasourceUrl:url});process.env.POKEMON_SIMULATOR_PORTABLE='1';
  server=createApp({db,config:{CORS_ORIGIN:'http://127.0.0.1'}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async()=>{ save=await post('/jogador/saves',{nomeTreinador:'Batalha UI'},null); });
test.afterAll(async()=>{ if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.$disconnect();if(temporary)rmSync(temporary,{recursive:true,force:true}); });

test('novo save permite somente os três iniciais de Kanto e mantém IVs perfeitos',async({page})=>{
  await enter(page,'/inicial');
  await expect(page.locator('.starter-card')).toHaveCount(3);
  await expect(page.getByRole('group',{name:'Escolher geração inicial'})).toHaveCount(0);
  const blocked=await fetch(`${origin}/api/jogador/inicial`,{method:'POST',headers:{'Content-Type':'application/json','X-Save-Id':save.id},body:JSON.stringify({saveId:save.id,especieId:152})});
  expect(blocked.status).toBe(400);
  await page.locator('.starter-card').filter({has:page.getByRole('heading',{name:'Charmander'})}).click();
  await page.getByRole('button',{name:'Escolher Charmander'}).click();
  await page.getByRole('button',{name:'Confirmar meu parceiro'}).click();
  await expect(page).toHaveURL(/\/menu$/);
  const member=await db.pokemonCapturado.findFirstOrThrow({where:{saveId:save.id}});
  expect(member.especieId).toBe(4);expect(member.ivs).toEqual(perfectIvs());
});

test('sprites de frente alinhadas, filtros, cura e captura com bolsa',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await post('/jogador/inicial',{saveId:save.id,especieId:4});
  await db.pokemonCapturado.create({data:{saveId:save.id,especieId:1,nivel:12,hpAtual:30,shiny:true,ivs:perfectIvs()}});
  await db.itemInventario.create({data:{saveId:save.id,itemId:'master-ball',quantidade:1}});
  await post('/batalhas/iniciar',{tipo:'selvagem',regiao:'kanto',intervaloNivel:{minimo:1,maximo:1}});
  await enter(page,'/selvagens');
  await expectFilterRows(page);
  await page.screenshot({path:info.outputPath('wild-filter-rows.png'),fullPage:true});
  await page.getByLabel('Filtrar Pokémon para batalha por brilho').selectOption('shiny');
  await page.getByLabel('Filtrar Pokémon para batalha por estrelas').selectOption('4');
  await expect(page.locator('.battle-collection .battle-member')).toHaveCount(1);
  await expect(page.locator('.battle-member')).toContainText('Bulbasaur');
  await page.getByLabel('Filtrar Pokémon para batalha por brilho').selectOption('');
  await page.locator('.battle-member').filter({hasText:'Charmander'}).click();
  await expect(page.locator('.battle-selected-team')).toContainText('Entra primeiro');
  await page.getByRole('button',{name:'Escolher para batalhar'}).click();
  const player=page.locator('.battle-player > .variant-image'),foe=page.locator('.battle-foe > .variant-image');
  await expect(player).toHaveAttribute('src',/4-front\.png$/);
  await expect(foe).not.toHaveAttribute('src',/-back/);
  const a=await player.boundingBox(),b=await foe.boundingBox();
  expect(a.y+a.height).toBeLessThan(b.y);
  expect(Math.abs(a.x+a.width/2-b.x-b.width/2)).toBeLessThan(1);
  await page.getByRole('tab',{name:'Bolsa',exact:true}).click();
  await expect(page.getByRole('button',{name:'Usar Poção',exact:true})).toBeDisabled();
  await expect(page.locator('.battle-item-preview').first()).toContainText('HP completo');
  const round=await db.batalha.findUniqueOrThrow({where:{saveId:save.id}}),state=round.estado;
  state.jogador.hp=1;state.oponente.stats.attack=1;state.oponente.stats['special-attack']=1;
  state.oponente.ataques=[{nome:'pound',tipo:'normal',categoria:'physical',poder:1,precisao:100,prioridade:0}];
  await db.batalha.update({where:{id:round.id},data:{estado:state}});
  await page.reload();await page.getByRole('tab',{name:'Bolsa',exact:true}).click();
  const recovered = Math.min(20,state.jogador.maxHp - 1);
  await expect(page.locator('.battle-item-preview').first()).toContainText(`recuperará ${recovered} HP`);
  await page.getByRole('button',{name:'Usar Poção',exact:true}).click();
  await expect(page.locator('.battle-log')).toContainText(`recuperou ${recovered} HP`);
  expect((await db.itemInventario.findUniqueOrThrow({where:{saveId_itemId:{saveId:save.id,itemId:'potion'}}})).quantidade).toBe(4);
  await page.getByRole('group',{name:'Poké Bola',exact:true}).getByRole('button').filter({hasText:'Master Bola'}).click();
  await expect(page.locator('.battle-extras')).toContainText('garante a captura');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('battle-bag.png'),fullPage:true});
  await page.getByRole('button',{name:'Capturar com Master Bola'}).click();
  await expect(page.getByRole('heading',{name:'Pokémon capturado!'})).toBeVisible();
  expect(await db.batalha.count({where:{saveId:save.id}})).toBe(0);expect(errors).toEqual([]);
});

test('ordem da equipe, reviver e troca por reserva preservam a batalha',async({page},info)=>{
  await post('/jogador/inicial',{saveId:save.id,especieId:1});
  await db.pokemonCapturado.create({data:{saveId:save.id,especieId:4,nivel:20,hpAtual:50}});
  await db.itemInventario.create({data:{saveId:save.id,itemId:'revive',quantidade:1}});
  await post('/batalhas/iniciar',{tipo:'treinador',dificuldade:'facil'});
  await enter(page,'/batalha');
  await expectFilterRows(page);
  await page.screenshot({path:info.outputPath('battle-filter-rows.png'),fullPage:true});
  await page.locator('.battle-member').filter({hasText:'Bulbasaur'}).click();
  await page.locator('.battle-member').filter({hasText:'Charmander'}).click();
  await page.getByRole('button',{name:'Enviar Charmander primeiro'}).click();
  await expect(page.locator('.battle-selected-team > div').first()).toContainText('Charmander');
  await page.getByRole('button',{name:'Escolher para batalhar'}).click();
  await expect(page.locator('.battle-player .battle-life')).toContainText('Charmander');
  const round=await db.batalha.findUniqueOrThrow({where:{saveId:save.id}}),state=round.estado;
  state.jogador.hp=0;state.aguardandoReviver=true;
  await db.batalha.update({where:{id:round.id},data:{estado:state}});
  await page.reload();
  await expect(page.locator('.battle-reserve-card')).toContainText('Bulbasaur');
  await page.getByRole('button',{name:'Usar Reviver',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Equipe',exact:true})).toBeVisible();
  const healed=(await db.batalha.findUniqueOrThrow({where:{saveId:save.id}})).estado;
  expect(healed.jogador.hp).toBe(Math.ceil(healed.jogador.maxHp/2));
  await page.getByRole('tab',{name:'Equipe',exact:true}).click();
  await page.screenshot({path:info.outputPath('battle-team.png'),fullPage:true});
  await page.locator('.battle-reserve-card').filter({hasText:'Bulbasaur'}).click();
  await expect(page.locator('.battle-player .battle-life')).toContainText('Bulbasaur');
  await page.reload();await expect(page.locator('.battle-player .battle-life')).toContainText('Bulbasaur');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
