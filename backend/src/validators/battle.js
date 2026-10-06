import { z } from 'zod';

export const startBattleSchema = z.object({
  tipo: z.enum(['selvagem', 'treinador', 'desafio', 'torneio']),
  regiao: z.enum(['kanto', 'johto', 'hoenn', 'sinnoh', 'unova1', 'unova2', 'kalos', 'alola', 'galar', 'paldea', 'todas']).optional(),
  desafioId: z.string().min(1).max(40).optional(),
  torneioId: z.enum(['muito-facil', 'facil', 'intermediario', 'dificil', 'muito-dificil', 'copa-prime']).optional(),
  dificuldade: z.enum(['facil', 'medio', 'dificil']).optional(),
  intervaloNivel: z.object({ minimo: z.number().int().min(1).max(100), maximo: z.number().int().min(1).max(100) }).strict().refine(intervalo => intervalo.minimo <= intervalo.maximo, { message: 'O nível mínimo deve ser menor ou igual ao máximo.' }).optional(),
  ambiente: z.enum(['field', 'cave', 'water', 'fishing']).optional(),
  selvagem: z.object({ regiao: z.enum(['kanto', 'johto', 'hoenn', 'sinnoh', 'unova1', 'unova2', 'kalos', 'alola', 'galar', 'paldea']), especieId: z.number().int().min(1).max(1025), nivel: z.number().int().min(1).max(100) }).strict().optional(),
}).strict().refine((body) => body.tipo === 'desafio' ? Boolean(body.desafioId) && !body.torneioId && !body.dificuldade && !body.selvagem && !body.regiao : body.tipo === 'treinador' ? Boolean(body.dificuldade) && !body.torneioId && !body.desafioId && !body.selvagem && !body.regiao : body.tipo === 'torneio' ? Boolean(body.torneioId) && !body.desafioId && !body.dificuldade && !body.selvagem && !body.regiao : !body.torneioId && !body.desafioId && !body.dificuldade && (!body.selvagem || !body.regiao || body.selvagem.regiao === body.regiao), { message: 'Seleção de batalha inválida.' }).refine(body => !body.intervaloNivel || (body.tipo === 'selvagem' && !body.selvagem), { message: 'O intervalo de níveis está disponível apenas para encontros surpresa.' }).refine(body => !body.ambiente || body.tipo === 'selvagem', { message: 'O ambiente só pode ser selecionado em encontros selvagens.' });
export const battleActionSchema = z.object({
  batalhaId: z.string().min(1).max(30),
  versao: z.number().int().nonnegative(),
  acao: z.enum(['escolher', 'trocar', 'procurar', 'ataque', 'capturar', 'fugir', 'usar-item', 'desistir', 'abandonar']),
  pokemonId: z.string().min(1).max(30).optional(),
  pokemonIds: z.array(z.string().min(1).max(30)).min(1).max(6).refine((ids) => new Set(ids).size === ids.length).optional(),
  golpe: z.string().min(1).max(80).optional(),
  itemId: z.string().min(1).max(40).optional(),
}).strict().refine((body) => body.acao !== 'escolher' || Boolean(body.pokemonId || body.pokemonIds?.length), { message: 'Escolha um Pokémon.' }).refine((body) => body.acao !== 'trocar' || Boolean(body.pokemonId), { message: 'Escolha o substituto.' }).refine((body) => body.acao !== 'ataque' || Boolean(body.golpe), { message: 'Escolha um ataque.' }).refine((body) => !['capturar', 'usar-item'].includes(body.acao) || Boolean(body.itemId), { message: 'Escolha um item.' });
