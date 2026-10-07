# Histórico de versões

## v1.2.1 — busca automática de Pokémon selvagens

- A busca automática custa 25 moedas por giro, permite filtrar por intervalo de estrelas de IV e só é liberada após vencer os oito Ginásios de Kanto.
- Se encontrar um Shiny de 4 estrelas, pausa mesmo que não corresponda aos filtros selecionados.
- Após concluir uma região e liberar a busca específica, selecionar uma espécie na busca automática passa a gerar somente essa espécie, no nível escolhido, inclusive nos giros usados para procurar IVs ou Shiny.
- Mensagens de validação da API ficam mais claras na interface.

## v0.1.1 — inicializador do jogo

- `iniciar-jogo.cmd` inicia o jogo no Windows com dois cliques, sem abrir dois terminais.
- `npm start` faz o mesmo em um único terminal em outros sistemas.
- Primeira execução prepara dependências, Prisma, migrations e golpes; o jogador configura apenas o acesso ao MySQL.

## v0.1.0 — primeira versão pública

- Conta de treinador, save único, escolha de inicial e coleção das nove gerações.
- Pokédex com sprites locais, formas especiais, filtros e detalhes de evolução.
- Batalhas selvagens, treinadores, desafios regionais e torneios com equipes selecionáveis.
- Loja com carrinho, mercado de Pokémon, missões, perfil e histórico.
- Pokécassino com caça-níqueis, cartas, roleta e Voltorb Flip.
- API Express, persistência Prisma/MySQL e testes automatizados.

Consulte o [README](README.md) para instalar, configurar o banco e executar o projeto.
