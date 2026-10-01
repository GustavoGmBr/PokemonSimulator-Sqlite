CREATE TABLE "LojaPokemonEstoque" (
    "saveId" TEXT NOT NULL PRIMARY KEY,
    "periodo" INTEGER NOT NULL,
    "estado" JSONB NOT NULL,
    CONSTRAINT "LojaPokemonEstoque_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
