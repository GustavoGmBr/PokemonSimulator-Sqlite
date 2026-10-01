import { z } from 'zod';

const money = z.number().int().min(5).max(20_000_000);
const pokemon = z.enum(['Pikachu', 'Bulbasaur', 'Charmander', 'Squirtle']);
const color = z.enum(['vermelho', 'preto', 'verde']);
const casinoItems = z.array(z.object({ itemId: z.string().min(1).max(60), quantidade: z.number().int().min(1).max(999) }).strict()).min(1).max(50).refine((items) => new Set(items.map((item) => item.itemId)).size === items.length);

export const buyChipsSchema = z.object({ quantidade: z.number().int().min(1).max(20_000_000) }).strict();
export const buyCasinoItemsSchema = z.object({ itens: casinoItems }).strict();
export const casinoWagerSchema = z.object({ aposta: money }).strict();
const rouletteBet = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('numero'), numero: z.number().int().min(0).max(36), valor: money }).strict(),
  z.object({ tipo: z.literal('paridade'), paridade: z.enum(['par', 'impar']), valor: money }).strict(),
  z.object({ tipo: z.literal('faixa'), faixa: z.enum(['baixa', 'alta']), valor: money }).strict(),
  z.object({ tipo: z.literal('duzia'), duzia: z.number().int().min(1).max(3), valor: money }).strict(),
  z.object({ tipo: z.literal('exata'), pokemon, cor: color, valor: money }).strict(),
  z.object({ tipo: z.literal('pokemon'), pokemon, valor: money }).strict(),
  z.object({ tipo: z.literal('cor'), cor: color, valor: money }).strict(),
]);
const pokemonWager = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('numero'), pokemonId: z.string().min(1).max(30), numero: z.number().int().min(0).max(36) }).strict(),
  z.object({ tipo: z.literal('paridade'), pokemonId: z.string().min(1).max(30), paridade: z.enum(['par', 'impar']) }).strict(),
  z.object({ tipo: z.literal('faixa'), pokemonId: z.string().min(1).max(30), faixa: z.enum(['baixa', 'alta']) }).strict(),
  z.object({ tipo: z.literal('duzia'), pokemonId: z.string().min(1).max(30), duzia: z.number().int().min(1).max(3) }).strict(),
  z.object({ tipo: z.literal('exata'), pokemonId: z.string().min(1).max(30), pokemon, cor: color }).strict(),
  z.object({ tipo: z.literal('pokemon'), pokemonId: z.string().min(1).max(30), pokemon }).strict(),
  z.object({ tipo: z.literal('cor'), pokemonId: z.string().min(1).max(30), cor: color }).strict(),
]);
export const rouletteSchema = z.object({ apostas: z.array(rouletteBet).max(24), pokemonAposta: pokemonWager.optional() }).strict().refine((body) => body.apostas.length > 0 || body.pokemonAposta, 'Escolha uma aposta.');
const roundAction = { rodadaId: z.uuid(), versao: z.number().int().min(0) };
export const roundActionSchema = z.object(roundAction).strict();
export const voltorbFlipSchema = z.object({ ...roundAction, indice: z.number().int().min(0).max(24) }).strict();
export const pokejackActionSchema = z.object({ ...roundAction, acao: z.enum(['pedir', 'parar', 'dobrar']) }).strict();
export const piplupActionSchema = z.object({ ...roundAction, acao: z.enum(['pular', 'sacar']) }).strict();
export const raceSchema = z.object({ aposta: money, pokemon: z.number().int().min(0).max(4) }).strict();
export const fortuneSchema = z.object({ aposta: money }).strict();
