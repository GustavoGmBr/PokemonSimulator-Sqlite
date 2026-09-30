# Pokémon Simulator — frontend

React 18, Vite, Tailwind CSS 4, componentes em JavaScript no padrão shadcn/ui com Radix, Framer Motion, Zustand, TanStack Query, Lucide e React Router. O botão usa o padrão Slot/CVA do shadcn; a confirmação acessível usa Radix AlertDialog, com foco preso ao diálogo e cancelamento por teclado.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Abra http://127.0.0.1:5185/saves. O backend deve estar ativo em 127.0.0.1:3435. Para alterar seu destino, copie `.env.example` para `.env` e configure `API_PROXY_TARGET`. A porta 5185 é fixa; o Vite informa se já estiver em uso.

## Fluxo

- `/saves`: escolher uma jornada existente, criar um save novo ou excluir um save.
- `/inicial`: escolher um inicial de qualquer geração, com confirmação.
- `/menu`: ver a coleção em destaque, marcar favoritos, filtrar e ordenar Pokémon; abrir os detalhes de um capturado para evoluir, ativar G-Max ou usar doces.
- `/mercado`: selecionar e vender Pokémon capturados por Pokédólares, inclusive vários de uma vez; favoritos ficam protegidos.
- `/loja`: montar um carrinho com Poké Bolas, itens de cura, evolução e bônus em qualquer quantidade permitida. Master Bola e doces não são vendidos nesta loja.
- `/cassino`: comprar fichas, jogar caça-níqueis, cartas, roleta e Voltorb Flip, e trocar fichas por Poké Bolas (inclusive Master Bola) e itens de cura. A escolha de Pokémon para a roleta mostra sprites, busca por nome e Nº Dex, filtros e ordenação por valor; favoritos não podem ser apostados.
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

Os arquivos ficam em `dist`. Em produção, configure fallback das rotas do frontend para `index.html` e encaminhe `/api` e `/assets/pokemon` para o Express. Alternativamente, defina `VITE_API_ORIGIN` antes do build para um backend separado e permita a origem do frontend no `CORS_ORIGIN` do backend. O proxy Vite é apenas de desenvolvimento. Não houve publicação em hospedagem nesta entrega.

## Teste no navegador

Com frontend, backend, catálogo e banco migrado disponíveis:

```powershell
npx playwright install chromium
npm run test:e2e
```

Os cenários Playwright existentes ainda estão sendo adaptados do fluxo com conta para a seleção de saves locais.

Capturas de tela ficam em `test-results`, ignorado pelo Git.
