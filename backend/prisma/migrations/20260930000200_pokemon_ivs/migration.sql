ALTER TABLE "PokemonCapturado" ADD COLUMN "ivs" JSONB NOT NULL DEFAULT '{"hp":15,"attack":15,"defense":15,"special-attack":15,"special-defense":15,"speed":15}';

-- Iniciais antigos não possuem bola de captura, inclusive após evoluir.
UPDATE "PokemonCapturado" SET "ivs" = '{"hp":31,"attack":31,"defense":31,"special-attack":31,"special-defense":31,"speed":31}'
WHERE "bolaCaptura" IS NULL AND "id" = (
  SELECT p."id" FROM "PokemonCapturado" p WHERE p."saveId" = "PokemonCapturado"."saveId"
  ORDER BY p."capturadoEm", p."id" LIMIT 1
) AND EXISTS (SELECT 1 FROM "Save" s WHERE s."id" = "PokemonCapturado"."saveId" AND s."inicialEspecieId" IS NOT NULL);
