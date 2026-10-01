O Pokécassino agora tem oito jogos, novas animações e rodadas que podem ser retomadas.

## Jogos melhorados

- **Caça-níqueis:** rolos com animação de rolagem, coringa que completa combinações, explicação das cinco linhas e tabela de pagamentos. Cada resultado mostra entrada, retorno e saldo da rodada.
- **Cartas:** baralho de 24 cartas na mesa. Clique para escolher a carta da aposta; depois vire as demais para conferir. Palpites exatos, dupla, número e Pokémon continuam disponíveis.
- **Roleta:** roda circular europeia com 37 casas (0 a 36), vermelho, preto e zero verde. Aposte em número, cor, paridade, faixa, dúzia ou grupo Pokémon. Número paga 36×; vermelho/preto, paridade e faixa pagam 2×; dúzia paga 3×; grupo paga 4×. A aposta de Pokémon da coleção mantém a proteção de favoritos e do último exemplar.
- **Voltorb Flip:** abra cinco cartas e receba a **soma** dos multiplicadores aplicada à entrada. Uma linha completa na horizontal ou vertical dobra o retorno. Cartas: 0×, 0,5×, 1×, 2×, 3× e 5×, com menos cartas de alto valor. Uma Voltorb soma zero e a rodada continua.

## Novos jogos

- **Pokejack:** blackjack com cartas animadas, ases de 1 ou 11, pedir, parar e dobrar. Vitória paga 2×; natural (21 com duas cartas) paga 3×; empate devolve a aposta. A banca para em 17.
- **Pokémon Race:** cinco Pokémon correm com avanço aleatório. Acerte o vencedor para receber 4× a aposta.
- **Wheel of Fortune:** roda vertical com setores de tamanhos diferentes, de 0× até 10×. Só o palpite que coincide com o setor sorteado paga. As chances aparecem ao lado dos multiplicadores.
- **Pula Piplup:** sete placas de gelo com retornos de 1×, 1,1×, 1,5×, 2×, 2,5×, 3,5× e 5×. Decida quando sacar; uma queda perde a entrada. O celular acompanha o Piplup durante os saltos.

Multiplicadores representam o retorno total da entrada, e prêmios fracionários são arredondados para baixo. Rodadas de Cartas, Voltorb, Pokejack e Piplup permanecem salvas ao fechar. Rodadas da versão antiga do Voltorb devolvem a entrada uma vez ao abrir o cassino atualizado. Animações respeitam a preferência de movimento reduzido.

## Downloads

- **PokemonSimulator-v0.3.0-compact-win-x64.zip**: sem sprites Pokémon; baixa o pacote de imagens no primeiro início e depois funciona offline.
- **PokemonSimulator-v0.3.0-complete-win-x64.zip**: inclui todas as 13.932 sprites e funciona offline desde a primeira abertura.
- **PokemonSimulator-v0.3.0-update-win-x64.zip**: pacote do atualizador; preserva saves, sprites e configuração local.

Extraia todos os arquivos e abra **PokemonSimulator.exe**. Não é necessário instalar Node.js, abrir CMD ou fazer login. O inicializador corrigido instala a atualização na próxima abertura. Se um inicializador antigo repete o download, feche o jogo, faça uma cópia de segurança de `backend/pokemon.db` e extraia a edição compacta sobre a pasta existente, substituindo os arquivos sem apagar seu banco.

Validação: testes das regras e transações em SQLite, proteção contra pagamentos repetidos, build de produção e testes dos oito jogos em desktop e celular, incluindo retomada, movimento reduzido e preservação de saves no pacote Windows.

Projeto de fã sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Veja os avisos de terceiros no pacote.
