# Histórico de versões

## v1.3.3 — desafios restritos à região

- Em ginásios, Elite e campeonatos regionais, só podem ser escolhidos Pokémon cuja espécie pertença à Pokédex da região do desafio. A regra é aplicada também no servidor.
- Evoluções para espécies de regiões ainda bloqueadas ficam indisponíveis até que o progresso do save libere aquela região.

## v1.3.2 — busca automática em gerações ainda não concluídas

- Corrigida a busca automática que ficava desabilitada ao escolher espécies de uma geração ainda não concluída.
- Antes de vencer o campeão da geração, a lista funciona como filtro nos giros normais da região; após a conclusão, a busca direta por espécie continua disponível.
- A tela explica quando os giros usam o filtro regional e quando a busca direta já foi liberada.

## v1.3.1 — seleção e leitura mais claras

- A busca automática agora adiciona cada Pokémon clicado a uma lista visual, com remoção individual antes de começar os giros.
- Poké Bolas mostram a chance atual em destaque, com cores por faixa; o valor acompanha as mudanças da batalha. A Bola Rápida recebe bônus de 6× no primeiro turno.
- A Pokédex ganhou um acesso direto ao Mercado Pokémon depois da lista, e o comparador apresenta sprites, IVs, bônus shiny e barras lado a lado.
- A criação de equipes mostra os seis espaços, a ordem de entrada e os Pokémon disponíveis com sprites, tipos e IVs.

## v1.3.0 — equipes, Pokédex e melhorias de batalha

- Equipes nomeadas de seis Pokémon são salvas na jornada, incluídas nos backups e usadas como filtro na escolha para batalhas; adicionado também o filtro de favoritos.
- Adicionadas efetividades de tipo na Pokédex e comparação de atributos entre Pokémon capturados com IVs e shiny aplicados.
- Nível de entrada em torneios limitado pela categoria, sem alterar o nível original do Pokémon.
- Alertas e confirmação para encontros shiny ou 4 estrelas; busca específica preserva a espécie e a busca automática aceita múltiplas espécies.
- Chances atuais de captura das Poké Bolas são exibidas e atualizadas conforme a batalha.
- Shiny passa a dar +50% nos atributos; Pedra Brilhante disponível por 1.000.000 ₽ na loja ou 350.000 fichas no cassino.
- Apelidos, doces no cassino, golpes característicos G-Max e prêmios em dinheiro por Pay Day e G-Max Gold Rush.

## v1.2.2 — pausa da busca automática em encontros raros

- A busca automática agora pausa se encontrar um Pokémon Shiny ou com 4 estrelas, mesmo quando a outra característica não estiver presente e mesmo que ele não corresponda aos filtros escolhidos.

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
