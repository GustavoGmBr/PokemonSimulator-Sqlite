-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Save" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "nomeTreinador" TEXT NOT NULL,
    "moedas" INTEGER NOT NULL DEFAULT 0,
    "fichas" INTEGER NOT NULL DEFAULT 0,
    "vitorias" INTEGER NOT NULL DEFAULT 0,
    "derrotas" INTEGER NOT NULL DEFAULT 0,
    "iniciadoEm" DATETIME,
    "inicialEspecieId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "kitEntregue" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Save_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PokemonCapturado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "especieId" INTEGER NOT NULL,
    "apelido" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 5,
    "experiencia" INTEGER NOT NULL DEFAULT 0,
    "hpAtual" INTEGER NOT NULL,
    "shiny" BOOLEAN NOT NULL DEFAULT false,
    "bolaCaptura" TEXT,
    "investimentoItens" INTEGER NOT NULL DEFAULT 0,
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "megaForma" TEXT,
    "gmaxForma" TEXT,
    "atributos" JSONB,
    "golpes" JSONB,
    "golpesDesbloqueados" JSONB,
    "posicaoTime" INTEGER,
    "capturadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PokemonCapturado_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GolpeBatalha" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "poder" INTEGER NOT NULL,
    "precisao" INTEGER,
    "prioridade" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EspecieAtaque" (
    "especieId" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    "golpeId" INTEGER NOT NULL,
    "nivelAprendido" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("especieId", "posicao"),
    CONSTRAINT "EspecieAtaque_golpeId_fkey" FOREIGN KEY ("golpeId") REFERENCES "GolpeBatalha" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Batalha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "estado" JSONB NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Batalha_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesafioConcluido" (
    "saveId" TEXT NOT NULL,
    "desafioId" TEXT NOT NULL,
    "vencidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("saveId", "desafioId"),
    CONSTRAINT "DesafioConcluido_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EspecieRegistrada" (
    "saveId" TEXT NOT NULL,
    "especieId" INTEGER NOT NULL,

    PRIMARY KEY ("saveId", "especieId"),
    CONSTRAINT "EspecieRegistrada_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemInventario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ItemInventario_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CassinoRodada" (
    "saveId" TEXT NOT NULL PRIMARY KEY,
    "estado" JSONB NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CassinoRodada_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatalhaEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "especieId" INTEGER,
    "regiao" TEXT,
    "dificuldade" TEXT,
    "torneioId" TEXT,
    "resultado" TEXT,
    "descricao" TEXT NOT NULL,
    "shiny" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatalhaEvento_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissaoResgatada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveId" TEXT NOT NULL,
    "periodo" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissaoResgatada_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Save_usuarioId_key" ON "Save"("usuarioId");

-- CreateIndex
CREATE INDEX "PokemonCapturado_saveId_especieId_idx" ON "PokemonCapturado"("saveId", "especieId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonCapturado_saveId_posicaoTime_key" ON "PokemonCapturado"("saveId", "posicaoTime");

-- CreateIndex
CREATE UNIQUE INDEX "GolpeBatalha_nome_key" ON "GolpeBatalha"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "EspecieAtaque_especieId_golpeId_key" ON "EspecieAtaque"("especieId", "golpeId");

-- CreateIndex
CREATE UNIQUE INDEX "Batalha_saveId_key" ON "Batalha"("saveId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemInventario_saveId_itemId_key" ON "ItemInventario"("saveId", "itemId");

-- CreateIndex
CREATE INDEX "BatalhaEvento_saveId_criadoEm_idx" ON "BatalhaEvento"("saveId", "criadoEm");

-- CreateIndex
CREATE INDEX "BatalhaEvento_saveId_tipo_regiao_criadoEm_idx" ON "BatalhaEvento"("saveId", "tipo", "regiao", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "MissaoResgatada_saveId_periodo_indice_key" ON "MissaoResgatada"("saveId", "periodo", "indice");

