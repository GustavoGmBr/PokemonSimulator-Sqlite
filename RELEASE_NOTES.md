## Pokémon Simulator SQLite v1.2.0

- Adicionada exportação e importação de saves pela tela de gerenciamento de jornadas.
- O arquivo de backup inclui treinador, Pokémon, inventário, progresso, histórico e estados de batalha e cassino; saves podem ser importados como uma nova jornada ou substituir um save existente após confirmação.
- Importações são validadas e aplicadas em uma transação SQLite para evitar substituir parcialmente uma jornada caso o arquivo seja inválido.

## Pokémon Simulator SQLite v1.1.3

- Removida a escolha de ambiente da busca de Pokémon selvagens e do estado da batalha.
- A Bola Aquática agora aplica seu bônus de 3,5× somente contra Pokémon do tipo Água.
- A bolsa e a loja mostram se cada item passivo está ativo e o bônus atual calculado pelo progresso do save.
- Ovo da Sorte e Amuleto da Sorte exibem seus multiplicadores de XP e dinheiro; Shiny Charm e Catch Charm mostram as chances por geração.
## Pokémon Simulator SQLite v1.1.2

- Missões de captura, treinadores no modo Fácil e torneios Muito fáceis agora entregam Poké Bolas especiais aleatórias no lugar da Poké Bola comum.
- A escolha da recompensa de missão fica estável durante o ciclo; as recompensas de treinador e torneio são sorteadas ao iniciar a disputa e permanecem vinculadas à batalha.
- A Bola Premier foi mantida fora desse sorteio, preservando sua obtenção pelo bônus de compra de Poké Bolas comuns.
- A sprite da Bola Congelante foi substituída pela arte da Lure Ball.
## Pokémon Simulator SQLite v1.1.1

- As bolas especiais foram adaptadas ao jogo: Bola Psíquica (tipo Psíquico, 3×), Crepúsculo (Sombrio/Fantasma, 4×), Ninho (Voador, 3×), Trovão (Elétrico, 3×), Dracônica (Dragão, 3×), Congelante (Gelo, 3×), das Fadas (Fada, 3,5×; tipo compartilhado, 3×), de Treino (Lutador, 3×), Floresta (Planta, 3×) e Incandescente (Fogo, 3×).
- A Bola Rápida mantém bônus de 5× no primeiro turno, dentro da faixa de 4–5×; a Bola de Sonho dá 4× contra Pokémon adormecidos.
- A Bola Pesada agora calcula o bônus pelo peso ou pela altura do Pokémon, com multiplicador máximo de 4×.
- Os bônus antigos de amizade das Bolas Amiga e de Luxo foram removidos, pois elas agora têm efeitos de captura por tipo. Bola Aquática, Bola de Rede, Cura e Premier mantêm suas regras adaptadas anteriores.
- Adicionado o ícone da Bola Incandescente ao catálogo local.
## Pokémon Simulator SQLite v1.1.0

- Adicionadas 16 Poké Bolas especiais com regras próprias de captura: Bola Rápida, do Tempo, do Crepúsculo, Aquática, de Rede, do Ninho, de Repetição, Pesada, Lunar, de Nível, do Amor, de Sonho, de Cura, de Luxo, Amiga e Premier.
- A tela de encontro permite informar se o local é uma caverna, área aquática ou pescaria para aplicar os bônus correspondentes. O bônus noturno usa o horário local do computador.
- A Bola de Cura restaura o Pokémon capturado e remove condições de status; as Bolas Amiga e de Luxo afetam a amizade, usada também em evoluções por amizade.
- A Bola Premier é concedida ao comprar 10 Poké Bolas comuns de uma vez. Catálogo e imagens dos itens foram adicionados ao jogo.
- Banco SQLite atualizado com sexo e amizade dos Pokémon, incluindo migração para saves existentes.
## Pokémon Simulator SQLite v1.0.0

- Bônus por concluir as dez missões do ciclo antes da renovação: 5.000 ₽, 500 fichas de cassino e um Doce Raro.
- O bônus é creditado uma única vez quando todas as tarefas estão concluídas e o jogador resgata uma missão; o painel informa progresso, valor do prêmio e se o bônus já foi recebido.
- Primeira versão principal estável do Pokémon Simulator SQLite, com saves locais e cliente para Windows.

## Pokémon Simulator SQLite v0.5.19

- Clique no nome do treinador no menu para consultar o saldo em dinheiro e as fichas do cassino.
- O botão “Escolher para batalhar” fica acessível na parte inferior da tela enquanto você seleciona a equipe.

## Pokémon Simulator SQLite v0.5.18

- Ovo da Sorte: experiência de batalha passa de 2× para até 4×, somando 25% por geração concluída da 2ª à 9ª.
- Amuleto da Sorte: dinheiro das vitórias passa de 2× para até 5×, somando 50% por geração concluída a partir da 2ª; o multiplicador tem teto em 5×.

## Pokémon Simulator SQLite v0.5.17

- Corrigido o caça-níquel: a combinação de dois Dittos com um espaço vazio não paga prêmio.

## Pokémon Simulator SQLite v0.5.16

- A chance de espaço vazio no caça-níquel aumentou de 15% para 25% por posição. Os demais símbolos dividem os outros 75% proporcionalmente.
- A descrição do jogo foi atualizada para informar a nova chance. Os multiplicadores e as regras do Ditto são preservados.

## Pokémon Simulator SQLite v0.5.15

- Espaços vazios retornaram ao caça-níquel, com 15% de chance por posição. Eles ficam visualmente vazios, sem pontos, e não completam trincas.
- Os símbolos atuais dividem os outros 85%, preservando suas chances relativas e os multiplicadores existentes. Duas figuras Ditto continuam devolvendo a aposta da linha e três pagam 4×.

## Pokémon Simulator SQLite v0.5.14

- Corrigida a prioridade do CSS que mantinha os filtros da batalha e dos encontros selvagens em uma única linha no jogo instalado.
- Primeira linha: nome ou número da Pokédex e tipo. Segunda linha: estrelas, nível e Normal/Shiny. O layout mantém as duas linhas no desktop e no celular.

## Pokémon Simulator SQLite v0.5.13

- Filtros da batalha organizados em duas linhas: nome ou número da Pokédex e tipo na primeira; estrelas, nível e Shiny na segunda. O nível agora filtra faixas de 20 níveis, e a ordenação por Pokédex foi removida.
- Voltorb Flip agora tem 11 cartas bomba no tabuleiro 6×6. Para manter 36 cartas, cinco cartas de 0,25× foram substituídas por Voltorbs. Encontrar uma bomba encerra a rodada e perde a aposta.

## Pokémon Simulator SQLite v0.5.12

- Voltorb Flip: tabuleiro 6×6 e seis escolhas, com bônus de linha horizontal ou vertical de 1,5×. As 36 cartas contêm 6 Voltorbs (0×), 10 de 0,25×, 9 de 0,5×, 5 de 1,2×, 3 de 1,5×, duas de 2× e uma de 5×. Voltorb encerra a rodada e perde toda a aposta. Rodadas 5×5 já iniciadas mantêm as regras anteriores até terminarem.
- Novos saves escolhem somente Bulbasaur, Charmander ou Squirtle como inicial, no nível 5 e com IVs perfeitos. Saves anteriores são preservados.
- Arena de batalha redesenhada: ambos os Pokémon de frente, com o jogador acima e o adversário abaixo, alinhados verticalmente.
- Seleção com filtros de nome, Pokédex, tipo, Shiny e estrelas, ordenação por nível, IVs ou Pokédex, além da ordem da equipe e escolha de quem entra primeiro.
- Ações organizadas em Ataques, Bolsa e Equipe. Itens mostram efeito, estoque e prévia de cura; as reservas exibem sprite, nível e HP.

## Downloads para Windows x64

- **Compacta:** não inclui as sprites; baixa as imagens no primeiro início.
- **Completa:** inclui as sprites para jogar offline desde o início.
- **Atualização:** atualiza uma instalação existente e preserva os saves e imagens locais.

Extraia o ZIP e abra **PokemonSimulator.exe**. Não é necessário abrir um CMD.
