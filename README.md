# Pokémon Simulator SQLite

Remake single-player em JavaScript com ES Modules. Frontend React 18 em `frontend/` e API Express/Prisma/SQLite em `backend/`. Os saves ficam em `backend/pokemon.db`; não é preciso criar conta nem conectar à internet para jogar.

Versão pública atual: **v0.2.2**. O repositório inclui o código-fonte e o inicializador Windows `PokemonSimulator.exe`. As sprites são baixadas automaticamente na primeira execução e depois são servidas localmente, sem consultar a PokéAPI durante as partidas. Este é um projeto de fã, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Os dados e sprites Pokémon pertencem aos respectivos titulares; os dados de referência foram obtidos via [PokéAPI](https://pokeapi.co/).

Os saves são locais e podem ser criados, escolhidos e excluídos na tela inicial. A configuração local fica em `backend/.env`, ignorado pelo Git.

## Executar localmente

Para jogar no Windows x64, baixe **PokemonSimulator-v0.2.2-win-x64.zip** na [release](https://github.com/GustavoGmBr/PokemonSimulator-Sqlite/releases/latest), extraia todos os arquivos e abra **PokemonSimulator.exe**. O runtime já está incluído: não é necessário instalar Node.js nem abrir CMD. Na primeira execução, conecte-se à internet para baixar o pacote de sprites (aproximadamente 938 MB). O progresso aparece no inicializador, que verifica a integridade do download antes de instalar as imagens. Depois disso, o jogo funciona offline. O banco SQLite é criado automaticamente.

Na abertura, o inicializador consulta a última release e instala atualizações antes de executar o jogo. Os downloads são verificados por SHA-256, com recuperação dos arquivos anteriores em caso de falha. Os saves e o `.env` são preservados. Sem conexão, a versão instalada continua disponível quando as sprites já foram preparadas. Imagens existentes e íntegras são aproveitadas; imagens ausentes são recuperadas automaticamente quando houver internet.

Para trabalhar no código-fonte, instale Node.js 22.12+ e clone o repositório:

```powershell
git clone https://github.com/GustavoGmBr/PokemonSimulator-Sqlite.git
cd PokemonSimulator-Sqlite
```

Abra `PokemonSimulator.exe` na raiz do clone. Ele prepara as dependências, o SQLite e as sprites automaticamente. No clone, Node.js precisa estar instalado; no ZIP para Windows, já vem incluído. Também é possível executar `npm start`. Para baixar somente as imagens, use `npm run sprites:download` na raiz.

No pacote para Windows, a janela do launcher mostra o progresso, abre o navegador na tela de saves quando o jogo estiver pronto e encerra os serviços ao fechar. Apenas um inicializador desta pasta pode ficar aberto. `iniciar-jogo.cmd` continua disponível como alternativa. Ao executar o código-fonte, o inicializador instala dependências quando necessário.

Em macOS ou Linux, ou se preferir usar um único terminal, execute `npm start` na pasta raiz. A API começa na porta 34435 e a interface de desenvolvimento em http://127.0.0.1:35185/saves. O inicializador escolhe outra porta livre quando necessário e exibe o endereço em `Jogo pronto:`. No ZIP para Windows, API e interface compartilham uma única porta. O jogo escuta apenas em 127.0.0.1, ignora configurações antigas de `VITE_API_ORIGIN` e configura o proxy de `/api` e `/assets` para a API desta instância. Não encerra nem consulta serviços que já ocupam essas portas.

Os detalhes da última execução pelo Windows ficam em `launcher/latest.log`. Para verificar a preparação do banco, a API, a listagem de saves e os sprites sem abrir o navegador, execute `./PokemonSimulator.exe --check` em PowerShell. Esse modo encerra os serviços ao concluir a verificação. O código de saída é `0` quando a verificação passa e `1` quando há falha ou outro inicializador desta pasta já está aberto.

Os detalhes da instalação de atualizações ficam em `launcher/update.log`. Use `--skip-update` para iniciar sem consultar o GitHub naquela execução. Não é necessário fazer login no GitHub para jogar ou atualizar.

### Publicar uma nova versão

Atualize a versão em `package.json` e as notas em `RELEASE_NOTES.md`. Execute `npm run release:build` no Windows para gerar os pacotes do jogo e da atualização com seus checksums em `dist/releases/vVERSAO`. As sprites são compactadas em um `.tar.gz` separado; se não mudarem, o manifesto continua usando o pacote já publicado. O banco inicial é gerado sem dados pessoais. Os executáveis compilados para esta versão também entram no clone. Em seguida, com o Git autenticado no GitHub, execute `npm run release:publish`. A release fica em rascunho até todos os arquivos serem enviados e verificados; os jogadores recebem a atualização na próxima abertura. O script publica os executáveis pequenos no Git, mas não publica saves, `.env`, credenciais, `node_modules` ou sprites no repositório.

### Início manual para desenvolvimento

Também é possível iniciar cada serviço separadamente, em dois terminais, após configurar `backend/.env`:

Backend (a partir da pasta raiz):

```powershell
cd backend
npm install
npm run prisma:generate
npm run db:setup
npm run catalog:seed-moves
npm run dev
```

Frontend (em outro terminal, a partir da pasta raiz):

```powershell
cd frontend
npm install
npm run dev
```

Antes de iniciar manualmente, execute `npm run sprites:download` na raiz. Abra http://127.0.0.1:35185/saves. Se a API usar uma porta diferente de 34435, configure `API_PROXY_TARGET` em `frontend/.env`. Para selecionar portas livres automaticamente e evitar configurações antigas, prefira o inicializador.

## Disponível

- Seleção de vários saves locais, criação de novas jornadas e exclusão de saves.
- Encontros selvagens com nível mínimo e máximo escolhidos dentro do limite liberado pelos desafios da região. Em todas as gerações, o limite segue a última região disponível; o intervalo permanece ao procurar outro Pokémon.
- Escolha de um inicial de qualquer geração de Kanto a Paldea no nível 5, persistida no arquivo SQLite. O novo save recebe 10 Poké Bolas e 5 Poções ao escolher o inicial.
- Menu com coleção em destaque, favoritos persistentes, filtros por número, nome, tipo, geração, shiny, forma e nível, e ordenação por captura ou força. O mercado em `/mercado` permite vender vários Pokémon capturados de uma vez, mantendo pelo menos um. A bolsa é agrupada por categoria; a loja em `/loja` permite buscar itens pelo nome e comprar diferentes itens e quantidades em um carrinho.
- Pokécassino em `/cassino`: cada ficha custa 5 ₽ e serve para jogar caça-níqueis, cartas, roleta e Voltorb Flip ou comprar Poké Bolas (incluindo Master Bola) e itens de cura. Na roleta, é possível filtrar os Pokémon da coleção por nome e valor, conferir a sprite e apostar um exemplar: ele sai da coleção em qualquer resultado, e uma vitória paga o valor de venda multiplicado em Pokédólares. Favoritos não podem ser vendidos nem apostados.
- Pokédex dos 1.025 com filtro por geração, capturados, forma shiny, sprites 2D/3D pré-renderizados e detalhes de atributos, XP, golpes e evolução. A galeria de formas mostra Normal, Mega, G-Max, Primal e fusões lado a lado com seus requisitos.
- Escolha visual de até quatro ataques por Pokémon e aba de TMs compatíveis, compradas para um exemplar específico com Pokédólares. Em batalha, cura e Poké Bolas são escolhidas por cartões com sprite e quantidade.
- Áreas separadas para selvagens e batalhas. O jogador pode procurar em qualquer região liberada ou em todas elas de uma vez. Lendários e míticos selvagens aparecem após vencer os quatro desafios finais da respectiva região; a escolha manual também respeita isso. Após derrotar o campeão de uma região, escolhe espécie e nível dos selvagens daquela região. Treinadores aleatórios e torneios usam Pokémon de todas as gerações, equilibrados pela dificuldade. Contra treinadores, desafios e torneios, é possível escolher até o mesmo número de Pokémon do adversário e alternar entre eles. Alola tem Provas Insulares e Galar tem a Copa dos Campeões.
- Perfil do treinador com insígnias e histórico de batalhas, capturas e encontros shiny. A aba Missões oferece dez objetivos renovados a cada duas horas, contagem regressiva e resgate individual ou coletivo das recompensas. Tipos usam sprites Sword/Shield da PokéAPI; os golpes mostram efetividade e a escolha de Pokémon para batalha indica vantagem, neutralidade ou desvantagem por tipo.
- Vitórias contra selvagens e desafios rendem 10 Pokédólares por nível de cada adversário derrotado. Treinadores pagam 1.000/3.000/10.000 Pokédólares e itens conforme a dificuldade, sem Master Bola. Amulet Coin dobra o dinheiro, Lucky Egg dobra XP, e Shiny Charm e Catch Charm melhoram suas chances conforme os desafios da região do Pokémon vencidos.
- Evolução pela coleção do menu, com requisitos de nível ou item. Mega Evoluções permanentes exigem nível 60 e uma pedra específica; Rayquaza usa a Mega Rayquazatrite. Regressões Primais permanentes de Groudon e Kyogre exigem nível 60 e o Orbe Vermelho ou Azul; G-Max permanente usa a Pedra G-Max universal e concede +50% de HP máximo. Esses itens são de uso único e desaparecem da bolsa ao consumir a última unidade. Necrozma pode se fundir com Solgaleo, Lunala ou ambos; Ultra Necrozma também exige a Pedra Ultra Burst de 150.000 ₽. Os parceiros permanecem na coleção. Mega Pedras custam 50.000 ₽, Orbes Primais 100.000 ₽ e a Pedra G-Max 75.000 ₽.
- Doce Raro e Doces de EXP P/M/G/GG são recompensas de torneios, não vendidos na loja. Os Doces de EXP concedem 800/3.000/10.000/30.000 XP. Capturar um selvagem concede XP como derrotá-lo. Master Bola pode ser obtida como prêmio ou com fichas no cassino, mas não é vendida na loja comum.
- Catálogo local com atributos, tipos, crescimento, evoluções, aprendizado, 781 golpes, 145 itens e sprites das 1.025 espécies de Kanto a Paldea, 97 formas Mega, 2 formas Primal, 34 formas G-Max, 3 formas de Necrozma e 18 tipos.

O jogo não consulta a PokéAPI durante a navegação. Saves, inventário e batalhas usam a API local e o arquivo SQLite. Os sprites chamados de 3D são animações pré-renderizadas, sem câmera giratória. Johto, Hoenn, Sinnoh e Unova 1 abrem após os oito ginásios da região anterior; Unova 2 abre após Alder. Kalos exige vencer Alder e Iris; Alola, Galar e Paldea abrem após os oito desafios iniciais da região anterior. É possível escolher o inicial de qualquer uma das nove gerações ao criar o save.

## Atualizar o catálogo

O catálogo e as imagens já estão importados. Para repetir a importação:

```powershell
cd backend
npm run catalog:import
npm run catalog:seed-moves
# Para buscar novamente os dados e as imagens, ignorando o cache:
npm run catalog:import -- --refresh
```

Consulte [as instruções da API](backend/README.md), [as instruções do frontend](frontend/README.md) e [a descrição do catálogo](backend/data/README.md).
