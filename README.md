# Pokémon Simulator SQLite

Remake single-player em JavaScript com ES Modules. Frontend React 18 em `frontend/` e API Express/Prisma/SQLite em `backend/`. Os saves ficam em `backend/pokemon.db`; não é preciso criar conta nem conectar à internet para jogar.

Versão pública atual: **v0.3.0**. O repositório inclui o código-fonte e o inicializador Windows `PokemonSimulator.exe`. As sprites são baixadas automaticamente na primeira execução e depois são servidas localmente, sem consultar a PokéAPI durante as partidas. Este é um projeto de fã, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Os dados e sprites Pokémon pertencem aos respectivos titulares; os dados de referência foram obtidos via [PokéAPI](https://pokeapi.co/).

Os saves são locais e podem ser criados, escolhidos e excluídos na tela inicial. A configuração local fica em `backend/.env`, ignorado pelo Git.

## Executar localmente

Para jogar no Windows x64, escolha uma edição na [release](https://github.com/GustavoGmBr/PokemonSimulator-Sqlite/releases/latest): **PokemonSimulator-v0.3.0-compact-win-x64.zip** (sem sprites; baixa as imagens no primeiro início) ou **PokemonSimulator-v0.3.0-complete-win-x64.zip** (inclui todas as sprites; funciona offline desde a primeira abertura). Extraia todos os arquivos e abra **PokemonSimulator.exe**. O runtime já está incluído: não é necessário instalar Node.js nem abrir CMD. Na edição compacta, conecte-se à internet na primeira execução para baixar o pacote de sprites (aproximadamente 938 MB). O progresso aparece no inicializador, que verifica a integridade do download antes de instalar as imagens. Depois disso, o jogo funciona offline. O banco SQLite é criado automaticamente.

Na abertura, o inicializador consulta a última release e instala atualizações antes de executar o jogo. Os downloads são verificados por SHA-256. Após o download, uma janela própria confirma a instalação antes de reiniciar, com recuperação dos arquivos anteriores em caso de falha. Os saves e o `.env` são preservados. Sem conexão, a versão instalada continua disponível quando as sprites já foram preparadas. Imagens existentes e íntegras são aproveitadas; imagens ausentes são recuperadas automaticamente quando houver internet.

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

Se uma versão anterior ficou presa no ciclo de download, feche o jogo e extraia o ZIP compacto desta versão sobre a pasta instalada, substituindo os arquivos. Faça uma cópia de segurança de `backend/pokemon.db` antes; não apague a pasta. O ZIP não contém seu banco pessoal nem `.env`. O novo inicializador corrige os argumentos Windows da passagem para o instalador.

### Publicar uma nova versão

Atualize a versão em `package.json` e as notas em `RELEASE_NOTES.md`. Execute `npm run release:build` no Windows para gerar as edições compacta, completa e o pacote de atualização com seus checksums em `dist/releases/vVERSAO`. As sprites são compactadas em um `.tar.gz` separado; se não mudarem, o manifesto continua usando o pacote já publicado. O banco inicial é gerado sem dados pessoais. Os executáveis compilados para esta versão também entram no clone. Em seguida, com o Git autenticado no GitHub, execute `npm run release:publish`. A release fica em rascunho até todos os arquivos serem enviados e verificados; os jogadores recebem a atualização na próxima abertura. O script publica os executáveis pequenos no Git, mas não publica saves, `.env`, credenciais, `node_modules` ou sprites no repositório.

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

## IVs

Cada Pokémon tem seis IVs de 0 a 31: HP, Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade (total máximo 186). Os IVs influenciam os atributos e são preservados ao capturar, evoluir, transformar e subir de nível. Iniciais recebem 31 em tudo; Pokémon já capturados em saves anteriores recebem 15 por atributo, mantendo o cálculo antigo. O inicial antigo, quando ainda identificável como o primeiro exemplar sem bola de captura, também é promovido a perfeito.

| Estrelas | Soma dos IVs | Qualidade | Bônus de valor |
| --- | --- | --- | --- |
| 0☆ | 0–90 | Decente / Ruim | — |
| ⭐ | 91–120 | Acima da média | — |
| ⭐⭐ | 121–150 | Muito bom | — |
| ⭐⭐⭐ | 151–185 | Fantástico / Excelente | +50% |
| ⭐⭐⭐⭐ | 186 | Potencial Perfeito | +100% |

Na lista Meus Pokémon aparecem apenas as estrelas dos IVs. Ao clicar em um Pokémon, os detalhes mostram os seis valores, total, porcentagem e qualidade. Encontros selvagens usam ⭐, ⭐⭐, ⭐⭐⭐ ou ⭐⭐⭐⭐; a classificação sem estrelas continua como 0☆. Filtre a coleção por estrelas e intervalo de porcentagem. As seis **Essências de IV** aumentam +1 no atributo correspondente (limite 31), custam 5.000 ₽ ou 1.000 fichas cada e são obtidas em missões e torneios. Use na aba Atributos dos detalhes do Pokémon, fora de batalha. Um IV já máximo não consome o item.

## Pokécassino

Sete jogos usam fichas locais. Multiplicadores representam o retorno total, incluindo a entrada; apostar 10 fichas e receber 2× devolve 20. Prêmios fracionários são arredondados para baixo.

Em qualquer jogo também é possível colocar um Pokémon da coleção em risco. Se a aposta vencer, o Pokémon gera um prêmio em Pokédólares conforme o multiplicador do resultado e o mesmo valor convertido em fichas (5 ₽ por ficha). Se perder, o Pokémon é removido; favoritos ficam protegidos e é preciso manter ao menos um exemplar.

- **Caça-níqueis:** três rolos animados e oito linhas (três horizontais, três verticais e duas diagonais). Ditto substitui um dos símbolos para completar trincas; três Ditto pagam 5×. Trincas pagam por símbolo: Poké Bola 0,5×, Grande Bola 1,5×, Ultra Bola 3×, Pikachu 5×, cada inicial 10×, cada ave lendária 20×, Mewtwo 30×, Mew 50× e Master Bola 100×. Cada linha usa a aposta inteira e os prêmios das linhas são somados. É possível jogar sem fichas apostando um Pokémon.
- **Roleta:** roda europeia circular, 37 casas (0 a 36), com 18 vermelhas, 18 pretas e zero verde. As casas mostram seus Pokémon: Charmander nos ímpares vermelhos, Squirtle nos ímpares pretos, Bulbasaur nos pares vermelhos, Pikachu nos pares pretos e Mew no zero. Número e verde pagam 36×, vermelho/preto, paridade e faixa pagam 2×, dúzia paga 3× e grupo Pokémon paga 4×. O zero fica fora de paridade, faixas e dúzias. A aposta de um Pokémon da coleção continua disponível, com proteção de favoritos e do último exemplar.
- **Voltorb Flip:** abra até cinco cartas, some seus multiplicadores e aplique a soma à entrada. Uma linha horizontal ou vertical completa dobra o retorno; diagonais não contam. A mesa tem 6 Voltorbs, 8 cartas de 0,5×, 6 de 1×, 3 de 2×, uma de 3× e uma de 5×. Encontrar um Voltorb encerra a rodada e perde a aposta.
- **Pokejack:** baralho de 52 cartas, ás de 1 ou 11, figuras de 10; banca para em 17. Vitória paga 2×, natural (21 com duas cartas) paga 3×, empate devolve a entrada. Dobrar debita outra entrada, dá uma carta e encerra a mão.
- **Pokémon Race:** cinco corredores com movimentos aleatórios; acertar o vencedor paga 4×.
- **Wheel of Fortune:** faça a aposta da rodada e gire. O multiplicador onde o ponteiro parar define o pagamento: 0×, 0,25×, 0,5×, 1×, 2×, 5× e 10× ocupam 20%, 18%, 18%, 20%, 16%, 6% e 2% da roda.
- **Pula Piplup:** sete saltos, com retornos de 1×, 1,1×, 1,5×, 2×, 2,5×, 3,5× e 5×. As chances de sucesso por salto são 90%, 85%, 80%, 80%, 75%, 70% e 65%. Saque após qualquer salto seguro; uma queda perde a entrada. A sétima placa paga automaticamente.

Voltorb, Pokejack e Piplup salvam a rodada em andamento. Termine ou abandone a rodada antes de fazer outra aposta ou comprar fichas. Uma rodada antiga de Voltorb ou Cartas recebe sua entrada de volta uma única vez ao abrir o novo cassino. Os sete jogos têm animações e respeitam a preferência de movimento reduzido.

## Disponível

- Seleção de vários saves locais, criação de novas jornadas e exclusão de saves.
- Encontros selvagens com nível mínimo e máximo escolhidos dentro do limite liberado pelos desafios da região. Em todas as gerações, o limite segue a última região disponível; o intervalo permanece ao procurar outro Pokémon.
- Escolha de um inicial de qualquer geração de Kanto a Paldea no nível 5, persistida no arquivo SQLite. O novo save recebe 10 Poké Bolas e 5 Poções ao escolher o inicial.
- Menu com coleção em destaque, favoritos persistentes, filtros por número, nome, tipo, geração, shiny, forma e nível, e ordenação por captura ou força. O mercado em `/mercado` oferece doze Pokémon de nível 1, renovados a cada hora; o estoque também pode ser atualizado por 3.000 ₽. Também permite vender Pokémon capturados. A bolsa é agrupada por categoria; a loja em `/loja` permite buscar itens pelo nome e comprar diferentes itens e quantidades em um carrinho.
- Pokécassino com sete jogos, animações, rodadas persistentes e loja de fichas.
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
