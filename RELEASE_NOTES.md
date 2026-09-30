Agora você pode escolher o intervalo de níveis dos encontros selvagens conforme os desafios cumpridos.

- Em **Selvagens → Encontro surpresa**, defina o nível mínimo e o máximo dentro do limite liberado pela região escolhida. Também é possível usar o mesmo mínimo e máximo para encontrar uma espécie aleatória em um nível exato.
- Em **Todas as gerações liberadas**, os níveis seguem o progresso da última região disponível. Por exemplo: com Kanto concluída e Johto recém-liberada, as opções ficam entre 1 e 10, conforme Johto, inclusive para espécies de Kanto. Conforme você vence os desafios de Johto, esse limite aumenta.
- O intervalo permanece ao procurar outro Pokémon, recarregar uma batalha ou iniciar outra busca pelo botão **Procurar novo Pokémon**.
- A tela informa qual região determina os níveis. O backend rejeita intervalos acima do progresso do save.
- A escolha de espécie após vencer o campeão, as regras de lendários e os bônus shiny continuam disponíveis.
- Não há alteração na estrutura do SQLite; os saves e encontros já existentes são compatíveis.

Para instalar, baixe **PokemonSimulator-v0.2.2-win-x64.zip**, extraia tudo e abra **PokemonSimulator.exe**. Quem já utiliza o jogo recebe a atualização ao abrir o inicializador. As sprites já instaladas são reaproveitadas; não é necessário baixar novamente o pacote de imagens.

Validação: 35 testes ativos do backend passaram, incluindo a progressão regional e a persistência dos intervalos. O novo fluxo também foi testado no navegador em desktop e mobile. Os 14 testes legados de MySQL permanecem desativados.

Projeto de fã sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Veja os avisos de terceiros no pacote.
