import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app.js';

const requireBackend=createRequire(new URL('../../backend/package.json',import.meta.url));
const { PrismaClient }=requireBackend('@prisma/client');
let temp,db,server,origin,save,wagered;
test.beforeAll(async()=>{
  temp=mkdtempSync(path.join(tmpdir(),'casino-ui-'));
  const file=path.join(temp,'test.db'),url=`file:${file.replaceAll('\\','/')}`;writeFileSync(file,'');
  for(const name of ['migrate-local.js','seed-moves.js']) {
    const result=spawnSync(process.execPath,[fileURLToPath(new URL(`../../backend/scripts/${name}`,import.meta.url))],{ env:{...process.env,DATABASE_URL:url},encoding:'utf8',windowsHide:true });
    expect(result.status,result.stderr || result.stdout).toBe(0);
  }
  db=new PrismaClient({ datasourceUrl:url });process.env.POKEMON_SIMULATOR_PORTABLE='1';
  server=createApp({ db,config:{ CORS_ORIGIN:'http://127.0.0.1' } }).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  async function post(route,body,headers={}) {
    const response=await fetch(`${origin}/api${route}`,{ method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body) });
    expect(response.ok).toBe(true);return (await response.json()).data;
  }
  save=await post('/jogador/saves',{ nomeTreinador:'Cassino UI' });
  await post('/jogador/inicial',{ saveId:save.id,especieId:4 },{'X-Save-Id':save.id});
  await db.save.update({ where:{id:save.id},data:{moedas:100000} });
  wagered=await db.pokemonCapturado.create({ data:{ saveId:save.id,especieId:25,nivel:20,hpAtual:35,bolaCaptura:'great-ball' } });
  await db.pokemonCapturado.create({ data:{ saveId:save.id,especieId:1,nivel:10,hpAtual:30,favorito:true } });
});
test.afterAll(async()=>{ if(server) await new Promise(resolve=>server.close(resolve));if(db)await db.$disconnect();if(temp)rmSync(temp,{recursive:true,force:true}); });
async function enter(page) {
  await page.addInitScript(saveId=>localStorage.setItem('pokemon-simulator-local-save',JSON.stringify({ state:{ saveId,usuario:{login:'Cassino UI'} },version:0 })),save.id);
  await page.goto(`${origin}/cassino`);
  await expect(page.getByRole('heading',{name:'A sorte está lançada.'})).toBeVisible();
}
async function dismissCasinoResult(page) {
  const dialog=page.locator('.casino-result-toast');
  if(await dialog.isVisible()) await dialog.getByRole('button',{name:'Fechar notificação'}).click();
}
async function snapshot(page,info,name) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({ path:info.outputPath(`${name}.png`),fullPage:true });
}
test('sete jogos: animações, pagamentos, escolhas e retomada das rodadas',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await enter(page);await expect(page.getByRole('tab')).toHaveCount(8);
  await page.locator('.casino-stake-picker > summary').click();
  await expect(page.getByLabel('Buscar por nome ou Nº Dex')).toBeVisible();
  await expect(page.getByLabel('Valor mínimo (₽)')).toBeVisible();
  await page.getByLabel('Buscar por nome ou Nº Dex').fill('Bulbasaur');
  await expect(page.getByRole('button',{name:/Favorito protegido Bulbasaur/})).toBeDisabled();
  await page.getByLabel('Buscar por nome ou Nº Dex').fill('Pikachu');
  await page.getByRole('button',{name:/Apostar Pikachu/}).click();
  await page.getByRole('button',{name:/Apostar Pikachu/}).click();
  await page.getByLabel('Comprar fichas · 5 ₽ cada').fill('1000');
  await page.getByRole('button',{name:'Comprar · 5.000 ₽'}).click();
  await expect(page.locator('.casino-result-toast')).toContainText('Compra realizada');
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-wallet')).toContainText('1.000');
  await page.getByLabel('Aposta em fichas').fill('200');
  const autoCount=page.getByLabel('Quantidade de giros');
  await expect(autoCount).toHaveAttribute('max','5');
  await expect(autoCount).toHaveValue('5');
  await autoCount.fill('2');
  await page.getByRole('button',{name:'Iniciar rolagem · 2×'}).click();
  await expect(page.locator('.casino-result-toast')).toHaveCount(0);
  await expect(page.locator('.slot-auto-finished')).toContainText('2 de 2 giros',{timeout:15000});
  await expect(page.locator('.casino-result-toast')).toContainText('Resumo da rolagem');
  await expect(page.locator('.casino-result-toast')).toContainText('Total gasto');
  await expect(page.locator('.casino-result-toast')).toContainText('400 fichas');
  await expect(page.locator('.casino-result-toast')).toContainText('Total ganho');
  await dismissCasinoResult(page);
  await page.getByRole('button',{name:'Girar',exact:true}).click();
  await expect(page.locator('.slot-machine')).toHaveClass(/slots-rolling/);
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('retorno:');
  await expect(page.locator('.slot-reel')).toHaveCount(3);
  await expect(page.locator('.slot-cell')).toHaveCount(9);
  await expect(page.locator('.slot-blank')).toHaveCount(0);
  await expect(page.locator('.slot-paytable > div')).toHaveCount(8);
  await snapshot(page,info,'slots');
  await page.getByLabel('Aposta em fichas').fill('5');

  await page.getByRole('tab',{name:'Roleta',exact:true}).click();
  await expect(page.locator('.roulette-number')).toHaveCount(37);
  await expect(page.getByRole('img',{name:'Roleta europeia circular com 37 casas'})).toBeVisible();
  await page.getByLabel('Tipo de palpite').selectOption('cor');
  await page.getByRole('button',{name:'Adicionar aposta',exact:true}).click();
  await page.getByText('Pokémon das casas e aposta de coleção', {exact:true}).click();
  await expect(page.getByRole('button',{name:/Favorito protegido Bulbasaur/})).toBeDisabled();
  await page.getByRole('button',{name:/Apostar Pikachu/}).click();
  await page.getByRole('button',{name:/Girar roleta/}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('Número');
  expect(await db.pokemonCapturado.findUnique({where:{id:wagered.id}})).toBeNull();
  await snapshot(page,info,'roulette');

  await page.getByRole('tab',{name:'Voltorb Flip'}).click();
  await expect(page.getByText('Linha completa · 1,5×',{exact:true})).toBeVisible();
  await expect(page.locator('.casino-muted')).toContainText('O 5× é o valor de uma carta');
  await page.getByRole('button',{name:'Iniciar rodada',exact:true}).click();
  await expect(page.locator('.casino-active-round')).toBeVisible();
  const old=(await db.cassinoRodada.findUniqueOrThrow({where:{saveId:save.id}})).estado;
  await db.cassinoRodada.update({where:{saveId:save.id},data:{estado:{...old,tabuleiro:[0.25,0.5,1.2,1.5,2,5,...Array(30).fill(0.5)]}}});
  await page.reload();await expect(page.getByRole('heading',{name:'Voltorb Flip',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Caça-níqueis'}).click();
  await expect(page.getByRole('button',{name:'Girar',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Retomar rodada'}).click();
  await expect(page.locator('.voltorb-card-grid .casino-flip-card')).toHaveCount(36);
  for(let i=1;i<=6;i++) {
    await page.getByRole('button',{name:`Carta Voltorb ${i}`,exact:true}).click();
    await expect(page.locator('.voltorb-progress')).toContainText(`${i} de até 6`);
  }
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('Linha completa');
  await expect(page.locator('.casino-result')).toContainText('retorno: 78 fichas');
  await snapshot(page,info,'voltorb');

  await page.getByRole('tab',{name:'Pokejack',exact:true}).click();
  await page.getByRole('button',{name:'Distribuir mão'}).click();
  await dismissCasinoResult(page);
  await expect(page.getByRole('button',{name:'Distribuir mão'}).or(page.getByRole('button',{name:'Pedir carta'}))).toBeEnabled();
  let round=await db.cassinoRodada.findUnique({where:{saveId:save.id}});
  const state={ jogo:'pokejack',id:round?.estado.id ?? randomUUID(),versao:round?.estado.versao ?? 0,aposta:5,jogador:[{valor:10,naipe:'♠'},{valor:10,naipe:'♥'}],banca:[{valor:10,naipe:'♣'},{valor:8,naipe:'♦'}],baralho:[{valor:1,naipe:'♠'}] };
  if(!round)await db.save.update({where:{id:save.id},data:{fichas:{decrement:5}}});
  await db.cassinoRodada.upsert({where:{saveId:save.id},create:{saveId:save.id,estado:state},update:{estado:state}});
  await page.reload();await expect(page.getByRole('heading',{name:'Pokejack',exact:true})).toBeVisible();
  await expect(page.locator('.card-hidden')).toHaveCount(1);
  await page.getByRole('button',{name:/Dobrar ·/}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('Você venceu');
  await expect(page.locator('.casino-result')).toContainText('retorno: 20 fichas');
  await expect(page.locator('.card-hidden')).toHaveCount(0);
  await snapshot(page,info,'pokejack');

  await page.getByRole('tab',{name:'Pokémon Race'}).click();
  await expect(page.getByText('Vencedor: 6×',{exact:true})).toBeVisible();
  await expect(page.locator('.casino-panel')).toContainText('Você recebe 6× a aposta');
  await page.getByRole('button',{name:'Largar corrida'}).click();
  await expect(page.locator('.race-countdown')).toBeVisible();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('venceu!');
  await expect(page.locator('.race-runner')).toHaveCount(5);
  await expect(page.locator('.race-winner')).toHaveCount(1);
  await snapshot(page,info,'race');

  await page.getByRole('tab',{name:'Wheel of Fortune'}).click();
  await expect(page.locator('.fortune-picks > div')).toHaveCount(7);
  await page.getByRole('button',{name:/Girar fortuna/}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('O ponteiro parou');
  await snapshot(page,info,'fortune');

  await page.getByRole('tab',{name:'Pula Piplup'}).click();
  await page.getByRole('button',{name:'Começar travessia'}).click();
  await expect(page.getByRole('button',{name:'Sacar 0 fichas'})).toBeDisabled();
  await page.getByRole('button',{name:'Pular para a placa 1'}).click();
  await expect(page.locator('.piplup-actor')).toHaveClass(/piplup-jumping/);
  await expect(page.getByRole('button',{name:'Começar travessia'}).or(page.getByRole('button',{name:/Sacar \d+ fichas/}))).toBeEnabled();
  const pending=await db.cassinoRodada.findUnique({where:{saveId:save.id}});
  if(pending) {
    await page.reload();
    await expect(page.getByRole('heading',{name:'Pula Piplup',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Sacar \d+ fichas/}).click();
    await expect(page.locator('.casino-result-toast')).toBeVisible();
    await dismissCasinoResult(page);
    await expect(page.locator('.casino-result')).toContainText('Saque realizado');
  } else await expect(page.locator('.casino-result')).toContainText('Piplup caiu');
  await snapshot(page,info,'piplup');
  await page.getByRole('tab',{name:'Loja de fichas'}).click();
  const ball=page.locator('.casino-items > div').filter({has:page.getByText('Poké Bola',{exact:true})});
  await ball.getByLabel('Quantidade').fill('2');await page.getByRole('button',{name:'Comprar itens'}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-panel')).toContainText('Compras selecionadas: 0');
  expect((await db.itemInventario.findUnique({where:{saveId_itemId:{saveId:save.id,itemId:'poke-ball'}}})).quantidade).toBe(12);
  expect(errors).toEqual([]);
});

test('animações reduzidas mantêm o resultado e a interface utilizável',async({page})=>{
  await page.emulateMedia({ reducedMotion:'reduce' });await enter(page);
  await page.getByLabel('Comprar fichas · 5 ₽ cada').fill('100');
  await page.getByRole('button',{name:'Comprar · 500 ₽'}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await page.getByRole('button',{name:'Girar',exact:true}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('retorno:');
  expect(await page.locator('.slot-strip').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('tab',{name:'Pula Piplup'}).click();
  await page.getByRole('button',{name:'Começar travessia'}).click();
  await expect(page.locator('.casino-active-round')).toBeVisible();
  const state=(await db.cassinoRodada.findUniqueOrThrow({where:{saveId:save.id}})).estado;
  await db.cassinoRodada.update({where:{saveId:save.id},data:{estado:{...state,passos:6}}});
  await page.reload();
  await expect(page.locator('.piplup-progress')).toContainText('6 de 7');
  const scene=page.locator('.piplup-scene-scroll');
  expect(await scene.evaluate(el=>{const actor=el.querySelector('.piplup-actor').getBoundingClientRect(),bounds=el.getBoundingClientRect();return actor.left>=bounds.left && actor.right<=bounds.right;})).toBe(true);
  await page.getByRole('button',{name:'Abandonar rodada',exact:true}).click();
  await page.getByRole('button',{name:'Abandonar e perder entrada',exact:true}).click();
  await expect(page.locator('.casino-result-toast')).toBeVisible();
  await dismissCasinoResult(page);
  await expect(page.locator('.casino-result')).toContainText('Rodada abandonada');
  await expect(page.locator('.casino-active-round')).toHaveCount(0);
});
