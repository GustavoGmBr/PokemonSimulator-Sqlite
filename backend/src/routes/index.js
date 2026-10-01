import { Router } from 'express';
import { ivItemSchema } from '../validators/jogador.js';
import { requireSaveContext } from '../middleware/save-context.js';
import { validate } from '../middleware/validate.js';
import { updateSaveSchema } from '../validators/auth.js';
import { createJogadorService } from '../services/jogador.js';
import { createJogadorController } from '../controllers/jogador.js';
import { novoSaveSchema, inicialSchema, evolveSchema, buyItemSchema, buyCartSchema, equipMovesSchema, buyTmSchema, expCandySchema, favoriteSchema, sellPokemonSchema, claimMissionSchema } from '../validators/jogador.js';
import { getCatalogo, getDetalhesEspecie, resumoEspecie } from '../services/catalogo.js';
import { createBattleService } from '../services/battles.js';
import { startBattleSchema, battleActionSchema } from '../validators/battle.js';
import { createEvolutionService } from '../services/evolutions.js';
import { createMoveManagementService } from '../services/moveManagement.js';
import { createJourneyService } from '../services/journey.js';
import { createMarketService } from '../services/market.js';
import { createCasinoService } from '../services/casino.js';
import { buyChipsSchema, buyCasinoItemsSchema, casinoWagerSchema, rouletteSchema, voltorbFlipSchema, roundActionSchema, pokejackActionSchema, piplupActionSchema, raceSchema, fortuneSchema } from '../validators/casino.js';
import { z } from 'zod';

const buyPokemonStockSchema = z.object({ stockId: z.string().uuid() }).strict();

export function createRouter(db, config) {
  const router = Router();
  const jogador = createJogadorController(createJogadorService(db));
  const battles = createBattleService(db);
  const evolutions = createEvolutionService(db);
  const moves = createMoveManagementService(db);
  const journey = createJourneyService(db);
  const market = createMarketService(db);
  const casino = createCasinoService(db);
  const requireSave = requireSaveContext(db);

  router.get('/health', (req, res) => res.json({ success: true, data: { status: 'online' } }));
  router.get('/health/ready', async (req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { database: 'online' } });
    } catch {
      res.status(503).json({ success: false, error: 'Banco de dados indisponivel.' });
    }
  });
  router.get('/jogador/saves', jogador.saves);
  router.post('/jogador/saves', validate(novoSaveSchema), jogador.criarSave);
  router.delete('/jogador/saves/:id', jogador.excluirSave);
  router.get('/catalogo', (req, res) => res.json({ success: true, data: {
    pokemon: getCatalogo().pokemon.map(resumoEspecie), tipos: getCatalogo().tipos, regras: getCatalogo().regras,
  } }));
  router.get('/catalogo/itens', (req, res) => res.json({ success: true, data: getCatalogo().itens ?? [] }));
  router.get('/catalogo/:id', (req, res) => res.json({ success: true, data: getDetalhesEspecie(req.params.id) }));

  router.use('/jogador', requireSave);
  router.get('/jogador/save', jogador.save);
  router.post('/jogador/inicial', validate(inicialSchema), jogador.inicial);
  router.patch('/jogador/save', validate(updateSaveSchema), jogador.updateSave);
  router.get('/jogador/time', jogador.time);
  router.get('/jogador/pc', jogador.pc);
  router.get('/jogador/pokemon', jogador.colecao);
  router.get('/jogador/pokemon/valores-venda', async (req, res, next) => {
    try { res.json({ success: true, data: await market.values(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/jogador/pokemon/vender', validate(sellPokemonSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await market.sell(req.usuarioId, req.body.pokemonIds) }); } catch (error) { next(error); }
  });
  router.get('/mercado/pokemon', requireSave, async (req, res, next) => {
    try { res.json({ success: true, data: await market.pokemon(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/mercado/pokemon/atualizar', requireSave, async (req, res, next) => {
    try { res.json({ success: true, data: await market.refreshPokemon(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/mercado/pokemon/comprar', requireSave, validate(buyPokemonStockSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await market.buyPokemon(req.usuarioId, req.body.stockId) }); } catch (error) { next(error); }
  });
  router.patch('/jogador/pokemon/:id/favorito', validate(favoriteSchema), jogador.favorito);
  router.post('/jogador/pokemon/:id/iv', validate(ivItemSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.improveIv(req.usuarioId, req.params.id, req.body.itemId) }); } catch (error) { next(error); }
  });
  router.get('/jogador/pokemon/:id/golpes', async (req, res, next) => {
    try { res.json({ success: true, data: await moves.options(req.usuarioId, req.params.id) }); } catch (error) { next(error); }
  });
  router.patch('/jogador/pokemon/:id/golpes', validate(equipMovesSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await moves.equip(req.usuarioId, req.params.id, req.body.golpes) }); } catch (error) { next(error); }
  });
  router.post('/jogador/pokemon/:id/tm', validate(buyTmSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await moves.buyTm(req.usuarioId, req.params.id, req.body.golpe) }); } catch (error) { next(error); }
  });
  router.get('/jogador/pokedex', async (req, res, next) => {
    try { res.json({ success: true, data: await createJogadorService(db).getDex(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.get('/jogador/pokemon/:id/evolucoes', async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.options(req.usuarioId, req.params.id) }); } catch (error) { next(error); }
  });
  router.post('/jogador/pokemon/:id/evoluir', validate(evolveSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.evolve(req.usuarioId, req.params.id, req.body.alvo) }); } catch (error) { next(error); }
  });
  router.post('/jogador/pokemon/:id/doce-raro', async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.useRareCandy(req.usuarioId, req.params.id) }); } catch (error) { next(error); }
  });
  router.post('/jogador/pokemon/:id/doce-exp', validate(expCandySchema), async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.useExpCandy(req.usuarioId, req.params.id, req.body.itemId) }); } catch (error) { next(error); }
  });
  router.post('/jogador/itens/comprar', validate(buyItemSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.buy(req.usuarioId, req.body.itemId) }); } catch (error) { next(error); }
  });
  router.post('/jogador/itens/carrinho', validate(buyCartSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await evolutions.buyCart(req.usuarioId, req.body.itens) }); } catch (error) { next(error); }
  });
  router.get('/jogador/inventario', jogador.inventario);
  router.get('/jogador/missoes', async (req, res, next) => {
    try { res.json({ success: true, data: await journey.missions(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/jogador/missoes/:indice/resgatar', validate(claimMissionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await journey.claim(req.usuarioId, req.body.periodo, Number(req.params.indice)) }); } catch (error) { next(error); }
  });
  router.get('/jogador/historico', async (req, res, next) => {
    try { res.json({ success: true, data: await journey.history(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.get('/batalhas/desafios', requireSave, async (req, res, next) => {
    try { res.json({ success: true, data: await battles.challenges(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.get('/batalhas/atual', requireSave, async (req, res, next) => {
    try { res.json({ success: true, data: await battles.current(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/batalhas/iniciar', requireSave, validate(startBattleSchema), async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await battles.start(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.post('/batalhas/acao', requireSave, validate(battleActionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await battles.act(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.get('/cassino', requireSave, async (req, res, next) => {
    try { res.json({ success: true, data: await casino.overview(req.usuarioId) }); } catch (error) { next(error); }
  });
  router.post('/cassino/fichas', requireSave, validate(buyChipsSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.buyChips(req.usuarioId, req.body.quantidade) }); } catch (error) { next(error); }
  });
  router.post('/cassino/itens', requireSave, validate(buyCasinoItemsSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.buyItems(req.usuarioId, req.body.itens) }); } catch (error) { next(error); }
  });
  router.post('/cassino/slots', requireSave, validate(casinoWagerSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.slots(req.usuarioId, req.body.aposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/roleta', requireSave, validate(rouletteSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.roulette(req.usuarioId, req.body.apostas, req.body.pokemonAposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/voltorb', requireSave, validate(casinoWagerSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.startVoltorb(req.usuarioId, req.body.aposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/voltorb/virar', requireSave, validate(voltorbFlipSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.flipVoltorb(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.post('/cassino/voltorb/desistir', requireSave, validate(roundActionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.leaveRound(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.post('/cassino/pokejack', requireSave, validate(casinoWagerSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.startPokejack(req.usuarioId, req.body.aposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/pokejack/acao', requireSave, validate(pokejackActionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.actPokejack(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.post('/cassino/corrida', requireSave, validate(raceSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.race(req.usuarioId, req.body.aposta, req.body.pokemon) }); } catch (error) { next(error); }
  });
  router.post('/cassino/fortune', requireSave, validate(fortuneSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.fortune(req.usuarioId, req.body.aposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/piplup', requireSave, validate(casinoWagerSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.startPiplup(req.usuarioId, req.body.aposta) }); } catch (error) { next(error); }
  });
  router.post('/cassino/piplup/acao', requireSave, validate(piplupActionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.actPiplup(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  router.post('/cassino/rodada/desistir', requireSave, validate(roundActionSchema), async (req, res, next) => {
    try { res.json({ success: true, data: await casino.leaveRound(req.usuarioId, req.body) }); } catch (error) { next(error); }
  });
  return router;
}
