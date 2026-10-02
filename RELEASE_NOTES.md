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
