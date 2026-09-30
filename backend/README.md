# Pokémon Simulator — API

Base em JavaScript ES Modules, Express 5, Prisma 6 e SQLite. O banco local é o arquivo `backend/pokemon.db`, criado pelo comando `db:setup`. Cada save é isolado e pode ser selecionado no frontend sem conta ou conexão externa.

## Executar

Requisitos: Node.js 22 ou superior.

```powershell
cd backend
npm install
npm run prisma:generate
```

Copie `.env.example` para `.env` se iniciar manualmente. A configuração padrão `DATABASE_URL="file:../pokemon.db"` cria o arquivo no diretório `backend/`. `CORS_ORIGIN` e `PORT` usam `http://127.0.0.1:35185` e `34435` por padrão. O inicializador da raiz escolhe outra porta se necessário, configura o frontend e baixa as sprites na primeira execução.

```powershell
npm run db:setup
npm run catalog:seed-moves
npm run dev
```

`db:setup` aplica as migrações ao arquivo SQLite e preserva os saves existentes. `npm start` executa sem Nodemon.

## Rotas

Todas usam o prefixo `/api`. Respostas de sucesso seguem `{ success: true, data: ... }`; erros seguem `{ success: false, error: ... }` e podem incluir `fields` para validação.

| Método | Rota | Cabeçalho | Finalidade |
| --- | --- | --- | --- |
| GET | `/health` | Não | Processo HTTP online |
| GET | `/health/ready` | Não | Conectividade com o banco local |
| GET | `/jogador/saves` | Não | Listar saves locais |
| POST | `/jogador/saves` | Não | Criar novo save |
| DELETE | `/jogador/saves/:id` | Não | Excluir um save |
| GET | `/catalogo` | Não | Catálogo resumido das 1.025 espécies e regras de referência |
| GET | `/catalogo/:id` | Não | Configuração completa da espécie |
| GET | `/catalogo/itens` | Não | Itens disponíveis |
| GET | `/jogador/save` | `X-Save-Id` | Consultar o save selecionado |
| POST | `/jogador/inicial` | `X-Save-Id` | Escolher o inicial uma única vez por save |
| PATCH | `/jogador/save` | `X-Save-Id` | Alterar apenas nomeTreinador |
| GET | `/jogador/pokemon` | `X-Save-Id` | Listar todos os Pokémon possuídos, sem limite |
| GET | `/jogador/time` | `X-Save-Id` | Alias legado para a coleção |
| GET | `/jogador/pc` | `X-Save-Id` | Consulta legada por posição antiga |
| GET | `/jogador/inventario` | `X-Save-Id` | Listar itens do jogador |
| POST | `/jogador/itens/comprar` | `X-Save-Id` | Comprar itens com preço; Master Bola e doces são exclusivos de recompensa |
| GET | `/jogador/pokedex` | `X-Save-Id` | Espécies já registradas no save, inclusive após evolução |
| GET | `/jogador/pokemon/:id/evolucoes` | `X-Save-Id` | Consultar evoluções e requisitos do Pokémon |
| POST | `/jogador/pokemon/:id/evoluir` | `X-Save-Id` | Evoluir usando nível ou item, inclusive Mega e G-Max |
| POST | `/jogador/pokemon/:id/doce-raro` | `X-Save-Id` | Consumir Doce Raro para subir um nível |
| POST | `/jogador/pokemon/:id/doce-exp` | `X-Save-Id` | Consumir `{ "itemId": "exp-candy-p" }` (P/M/G/GG) para ganhar XP |
| GET | `/batalhas/desafios` | `X-Save-Id` | Líderes, torneios, desbloqueios e nível selvagem máximo |
| GET | `/batalhas/atual` | `X-Save-Id` | Retomar a batalha ativa |
| POST | `/batalhas/iniciar` | `X-Save-Id` | Iniciar selvagem, treinador, desafio ou `{ "tipo": "torneio", "torneioId": "facil" }` |
| POST | `/batalhas/acao` | `X-Save-Id` | Escolher equipe, trocar Pokémon, atacar, usar cura, capturar, fugir, aceitar derrota ou abandonar torneio |

As rotas do save recebem seu identificador no cabeçalho `X-Save-Id`. A API verifica esse identificador em cada chamada e mantém Pokémon, itens, batalhas e progresso isolados por save.

## Organização

- `src/config`: leitura e validação do ambiente.
- `src/routes`: endpoints HTTP.
- `src/controllers`: adaptação HTTP do jogador.
- `src/services`: catálogo, saves e escolha do inicial.
- `src/middleware`: contexto do save e validação Zod.
- `src/lib`: cliente Prisma e tratamento de erros.
- `prisma`: modelos SQLite e setup do banco local.
- `data`: catálogo local importado da PokéAPI.
- `public/pokemon`: imagens locais servidas por `/assets/pokemon`.
- `scripts`: importador com cache, tentativas e concorrência limitada.
- `test`: testes HTTP e integridade do catálogo.

Criar um save inicia uma jornada (`iniciadoEm` preenchido) com moedas, vitórias e derrotas zeradas. Coleção e inventário começam vazios. Não existe endpoint para o cliente atribuir moedas, definir atributos ou declarar vitórias.

`PokemonCapturado.especieId` referencia o catálogo local. `posicaoTime` é um campo legado de saves antigos; todos os Pokémon pertencem à mesma coleção sem limite. A seleção cria o inicial no nível 5, com IVs 15, EVs zero, natureza neutra, HP cheio, experiência do nível e os golpes ofensivos que já aprendeu. Atributos, golpes equipados e golpes desbloqueados são persistidos no servidor.

## Save e inicial

Novo save: envie `POST /api/jogador/saves` com:

```json
{ "nomeTreinador": "Ash" }
```

Cada save tem seu próprio ID. Para carregar um, selecione-o no frontend; o navegador passa esse ID no cabeçalho `X-Save-Id` às rotas de jogo. `DELETE /api/jogador/saves/:id` remove uma jornada e todos os dados associados.

Escolha o inicial com `POST /api/jogador/inicial`:

```json
{ "saveId": "ID_DO_SAVE_INICIADO", "especieId": 1 }
```

São permitidos os três iniciais de cada geração, de Kanto a Paldea. A atualização condicional e a transação garantem uma única escolha por save, inclusive sob concorrência. Pedidos de saves antigos ou com inicial escolhido retornam 409. O carregamento de save é a leitura do estado existente, sem recriar os dados.


## Batalhas

`POST /batalhas/iniciar` recebe `{ "tipo": "selvagem" }`, `{ "tipo": "treinador", "dificuldade": "facil" }` ou `{ "tipo": "desafio", "desafioId": "brock" }`. Depois de vencer Blue, também aceita `{ "tipo": "selvagem", "selvagem": { "regiao": "kanto", "especieId": 25, "nivel": 77 } }`. A resposta já mostra o adversário. Em seguida, envie `POST /batalhas/acao` com `{ "batalhaId": "...", "versao": 0, "acao": "escolher", "pokemonIds": ["ID_DA_COLECAO"] }`. Para treinadores, desafios e torneios, `pokemonIds` aceita até `totalOponentes` exemplares; o primeiro entra em campo e os outros ficam nas reservas. `acao: "trocar"` com `pokemonId` de uma reserva faz a troca, consumindo um turno se o ativo ainda estiver de pé. A escolha inicial não consome turno. Para atacar, envie `acao: "ataque"` e `golpe` (nome do golpe); para capturar, `acao: "capturar"` e o `itemId` de uma Poké Bola disponível; para fugir de selvagens, `acao: "fugir"`. A versão impede aplicar duas ações simultâneas ao mesmo turno.

Cada Pokémon equipa de um a quatro golpes ofensivos. Os naturais são desbloqueados por nível conforme FireRed/LeafGreen em Kanto, HeartGold/SoulSilver em Johto, Omega Ruby/Alpha Sapphire em Hoenn, Platinum em Sinnoh, Black/White em Unova, X/Y em Kalos, Ultra Sun/Ultra Moon em Alola, Sword/Shield em Galar e Scarlet/Violet em Paldea; o jogador também pode comprar TMs compatíveis diretamente para um exemplar. A TM não ocupa a mochila, e o golpe aprendido permanece disponível mesmo se for retirado dos quatro equipados. Novos golpes por nível não substituem automaticamente a seleção. Se nenhum golpe natural estiver disponível, recebe Struggle. Não há PP nem efeitos de status. Shiny tem chance base de 1/4096 por encontro e +20% em todos os atributos calculados. Primeiras evoluções têm peso 120, intermediárias 30, finais 5 e lendários 1. Desafios têm equipes e limite de nível definidos; o Pokémon do jogador é reduzido ao limite durante o confronto. Giovanni é o 8º líder (nível 60) e Lorelei inicia a Elite no nível 65. A Elite abre após os oito ginásios, em sequência, e Blue após Lance. O nível selvagem máximo cresce com as conquistas. Johto e suas espécies #152–251 são liberados após vencer os oito ginásios de Kanto; a Elite de Johto abre após seus oito ginásios e o campeão Lance após a Elite. Hoenn e as espécies #252–386 abrem após os oito ginásios de Johto; Wallace lidera o 8º ginásio e Steven é o campeão. Sinnoh e as espécies #387–493 abrem após os oito ginásios de Hoenn; Volkner lidera o 8º ginásio e Cynthia é a campeã. Unova 1 (#494–649) abre após os oito ginásios de Sinnoh, com Drayden e Alder; Unova 2 abre após derrotar Alder em Unova 1, com Marlon e Iris. Kalos (#650–721) exige as vitórias sobre Alder e Iris; Alola (#722–809) abre após os oito desafios de Kalos, Galar (#810–905) após as oito Provas Insulares de Alola e Paldea (#906–1025) após os oito ginásios de Galar. Alola usa Provas Insulares e Galar usa a Copa dos Campeões no lugar de uma Elite dos 4.

Para administrar ataques de um Pokémon capturado, use `GET /api/jogador/pokemon/:id/golpes` para consultar os golpes equipados, desbloqueados e as TMs compatíveis com seus preços. `PATCH /api/jogador/pokemon/:id/golpes` recebe `{ "golpes": ["scratch", "flamethrower"] }`; `POST /api/jogador/pokemon/:id/tm` recebe `{ "golpe": "flamethrower" }` e debita as moedas do save. Ambas as alterações exigem que não haja batalha ativa.

Usar um item de cura em combate consome um turno: se o Pokémon ainda estiver de pé, o adversário responde. Quando ele desmaia, a batalha aguarda um Reviver, a troca por uma reserva ou a aceitação da derrota. Poções, Reviver e variantes só podem ser usados quando o HP permite. A vitória selvagem ou em desafio paga `10 × nível` por adversário derrotado, sem prêmio extra de Poké Bolas; captura rende XP, mas não dinheiro. Treinadores aleatórios pagam, respectivamente, 1.000/3.000/10.000 ₽ e itens de captura/cura para dificuldade fácil/média/difícil, sem Master Bola. Torneios cobram a inscrição ao começar, permitem escolher uma nova equipe com HP cheio após cada treinador e entregam os prêmios apenas após oito vitórias. Amulet Coin dobra o pagamento e Lucky Egg dobra o XP. Os bônus funcionam enquanto o item está na mochila, sem consumo; cada bônus permanente só pode ser comprado uma vez.

| Torneio | Inscrição | Prêmio em ₽ | Pokémon por treinador | Níveis |
| --- | ---: | ---: | ---: | ---: |
| Muito fácil | 150 | 120 | 3 | 2–10 |
| Fácil | 500 | 400 | 3–4 | 10–30 |
| Intermediário | 1.500 | 1.200 | 4–5 | 30–50 |
| Difícil | 4.000 | 3.200 | 5–6 | 50–70 |
| Muito difícil | 10.000 | 8.000 | 6 | 70–99 |
| Copa Prime | 25.000 | 20.000 | 6 | 100 |

Os prêmios de itens aparecem com suas faixas na tela do torneio; a Copa Prime pode entregar uma Master Bola. As equipes usam espécies coerentes com a dificuldade: formas iniciais fracas nas copas baixas, evoluções finais e Pokémon mais fortes nas altas. Sair ou perder encerra a disputa sem devolver a inscrição. O progresso da rodada fica salvo no arquivo SQLite e pode ser retomado após recarregar a página.

Shiny Charm aplica rolagens independentes de 1/4096: uma até o 3º ginásio, duas após o 4º e uma rolagem adicional em cada marco seguinte, chegando a 11 após Blue (chance efetiva aproximada de 1 em 372). Catch Charm acrescenta 3% à chance calculada de captura em cada um desses dez marcos, até **+30%** após Blue. Ambos os Charms se aplicam apenas a Pokémon da geração da região dos desafios; Kanto/Geração I, Johto/Geração II, Hoenn/Geração III, Sinnoh/Geração IV, Unova/Geração V, Kalos/Geração VI, Alola/Geração VII, Galar/Geração VIII e Paldea/Geração IX. As chances de captura continuam limitadas a 95%, exceto Master Bola, que garante 100%.

Lendários e míticos só entram no sorteio selvagem após vencer os quatro membros da Elite ou etapa final equivalente da própria região, inclusive na opção “todas as gerações”. A escolha manual de espécie também aplica essa regra. Em Unova, vencer a Elite de uma das campanhas basta para as espécies da Geração V. Treinadores aleatórios e de torneio podem usar Pokémon de todas as gerações desde o início; a dificuldade ainda controla níveis e composição das equipes.

## Coleção, missões e histórico

`PATCH /api/jogador/pokemon/:id/favorito` recebe `{ "favorito": true }` ou `false` e persiste a marcação. `GET /api/jogador/pokemon/valores-venda` calcula o valor por exemplar; `POST /api/jogador/pokemon/vender` recebe `{ "pokemonIds": ["id1", "id2"] }`, credita o total e retira os exemplares em uma transação, mantendo pelo menos um Pokémon. Favoritos são bloqueados na API: se algum exemplar selecionado for favorito, toda a venda é rejeitada. O valor é metade do preço da bola de captura mais `10 × nível`; Master Bola usa `20 × nível`. Somam-se as pedras de evolução consumidas, então aplicam-se bônus de ×3 para lendário/mítico e ×10 para shiny. Capturas antigas sem bola registrada usam Poké Bola. O registro da espécie na Pokédex permanece.

`POST /api/jogador/itens/carrinho` recebe `{ "itens": [{ "itemId": "poke-ball", "quantidade": 10 }] }` e debita todos os itens ou nenhum. O Pokécassino usa `GET /api/cassino`, `POST /api/cassino/fichas`, `/itens`, `/slots`, `/cartas`, `/roleta`, `/voltorb`, `/voltorb/virar` e `/voltorb/desistir`. Uma ficha custa 5 ₽. A Master Bola custa 10.000 fichas no cassino; os demais itens de captura e cura custam o preço normal convertido em fichas por 5. A roleta pode receber `pokemonAposta`; favoritos são recusados, e os demais exemplares saem da coleção após o giro mesmo sem acerto. Um acerto rende em Pokédólares o valor de venda multiplicado pelo prêmio da aposta.

`GET /api/jogador/missoes` retorna dez missões determinísticas por save e janela de duas horas: capturar espécies diferentes ou derrotar selvagens de uma região liberada, vencer treinadores de determinada dificuldade e vencer um torneio. O progresso é calculado dos eventos persistidos durante a janela; `POST /api/jogador/missoes/:indice/resgatar` recebe `{ "periodo": 123 }` e entrega moedas e itens uma única vez. `GET /api/jogador/historico` mostra até 60 eventos recentes e contadores de vitórias, derrotas, capturas e shinies encontrados. O registro histórico começa a partir desta atualização.

## Evolução e itens

No menu, abra os detalhes de um Pokémon capturado e selecione **Evolução**. A API valida nível, item, propriedade do Pokémon e ausência de batalha ativa. Evoluções por troca usam Cabo de Ligação, adequado ao jogo single-player. Evoluções para espécies até #1025 estão disponíveis; amizade usa nível 30 como regra simplificada, e trocas com item consomem o item correspondente. A Mega Evolução requer nível 60 e uma pedra específica; Groudon e Kyogre podem fazer Regressão Primal permanente no nível 60 com Orbe Vermelho ou Azul (100.000 ₽); G-Max usa a Pedra G-Max universal em espécies compatíveis, concede +50% de HP máximo e também é permanente. Mega, Primal e G-Max são mutuamente exclusivas. Todos os itens de evolução, Mega Pedras, Orbes Primais e Pedras G-Max são de uso único: a última unidade consumida desaparece da bolsa. As fusões de Necrozma seguem os requisitos próprios descritos abaixo. A Pokédex conserva o registro da espécie anterior. A loja não vende Master Bola, Doce Raro nem Doces de EXP. Estes últimos concedem 800/3.000/10.000/30.000 XP e são usados nos detalhes do Pokémon capturado. Mega Pedras custam 50.000 ₽, Pedra G-Max 75.000 ₽ e os bônus custam de 50.000 a 150.000 ₽.

O catálogo atual da PokéAPI inclui 97 formas Mega, 2 formas Primal, 34 formas G-Max e 3 formas de Necrozma. Groudon e Kyogre têm duas formas Primal separadas das Mega. As formas especiais usam atributos e sprites locais importados da PokéAPI. Necrozma Juba Crepúsculo exige Solgaleo na coleção; Asas Alvorada exige Lunala; Ultra Necrozma exige ambos e consome a Pedra Ultra Burst (150.000 ₽). Os parceiros não são consumidos, e uma fusão parcial pode ser transformada em Ultra Necrozma.

Mega Rayquaza usa a Mega Rayquazatrite de 50.000 ₽ no simulador, exigindo nível 60. A migração converte Meteoritos já comprados para a nova pedra. Beleza e afeto, quando exigidos pela evolução, usam nível 30 como regra simplificada.

## Verificação

`npm run prisma:validate` valida o modelo e `npm run db:setup` aplica as migrações ao banco SQLite local.

## Próximas entregas

Habilidades especiais e efeitos secundários de golpes ainda não fazem parte das regras atuais.

## Próximas entregas

Habilidades especiais e efeitos secundários de golpes ainda não fazem parte das regras atuais.
