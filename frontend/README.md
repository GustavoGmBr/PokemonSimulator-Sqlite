# Pokémon Simulator — frontend

React 18, Vite, Tailwind CSS 4, componentes em JavaScript no padrão shadcn/ui com Radix, Framer Motion, Zustand, TanStack Query, Lucide e React Router. O botão usa o padrão Slot/CVA do shadcn; a confirmação acessível usa Radix AlertDialog, com foco preso ao diálogo e cancelamento por teclado.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Prefira `PokemonSimulator.exe` ou `npm start` na raiz: o inicializador baixa as sprites, escolhe portas livres e configura o proxy da API desta instância. No início manual, abra http://127.0.0.1:35185/saves com o backend em 127.0.0.1:34435. Para alterar o destino manual, configure `API_PROXY_TARGET` no `.env` do frontend. A porta manual 35185 é fixa; o inicializador escolhe outra quando necessário.

## Fluxo

- `/saves`: escolher uma jornada existente, criar um save novo ou excluir um save.
- `/inicial`: escolher um inicial de qualquer geração, com confirmação.
- `/menu`: ver a coleção em destaque, marcar favoritos, filtrar e ordenar Pokémon; abrir os detalhes de um capturado para evoluir, ativar G-Max ou usar doces.
- `/mercado`: comprar dez Pokémon que mudam a cada seis horas e vender Pokémon capturados; estoque e compras são guardados por save.
- `/loja`: montar um carrinho com Poké Bolas, itens de cura, evolução e bônus em qualquer quantidade permitida. Master Bola e doces não são vendidos nesta loja.
- `/cassino`: comprar fichas, jogar caça-níqueis, roleta, Voltorb Flip, Pokejack, Pokémon Race, Wheel of Fortune e Pula Piplup; cartas foram removidas. A roleta mostra em cada casa o sprite do Pokémon correspondente. A Wheel of Fortune sorteia o multiplicador automaticamente.
- `/pokedex`: buscar e filtrar os 1.025 Pokémon, ver capturados, shiny, sprites e galeria de formas com requisitos.
- `/selvagens` e `/batalha`: encontrar selvagens ou desafiar treinadores, torneios e líderes; depois de ver o adversário, escolher uma equipe de até o mesmo tamanho da equipe adversária, trocar reservas, atacar, curar ou capturar. O Pokémon do jogador aparece de costas.
- `/perfil`: acompanhar insígnias e histórico de batalhas e capturas.
- `/missoes`: acompanhar dez missões renovadas a cada duas horas, ver a contagem regressiva e resgatar recompensas individualmente ou de uma vez.

As páginas internas usam o save selecionado no dispositivo. O progresso é gravado pela API local no arquivo SQLite; não há conta nem sessão online.

O save selecionado é lembrado em localStorage pelo Zustand. As imagens e o catálogo usados durante o jogo são servidos localmente.

## Build

```powershell
npm run build
```

Os arquivos ficam em `dist`. O pacote para Windows serve essa pasta pelo Express junto da API e dos assets. A interface usa sempre a própria origem para API e imagens; `VITE_API_ORIGIN` antigo é ignorado, evitando chamadas a outros sistemas no mesmo computador. O proxy Vite é usado somente em desenvolvimento.

## Teste no navegador

Com frontend, backend, catálogo e banco migrado disponíveis:

```powershell
npx playwright install chromium
npm run test:e2e
```

Os cenários Playwright existentes ainda estão sendo adaptados do fluxo com conta para a seleção de saves locais.

Capturas de tela ficam em `test-results`, ignorado pelo Git.
