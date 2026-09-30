Jogo offline para Windows x64 com saves SQLite, sem login.

Para jogar, baixe **PokemonSimulator-v0.2.0-win-x64.zip**, extraia todos os arquivos para uma pasta e abra **PokemonSimulator.exe**. O pacote já inclui o runtime, o catálogo e os sprites; não é necessário instalar Node.js nem usar CMD.

- A primeira tela permite criar, carregar e excluir saves locais.
- Na abertura, o inicializador consulta a versão mais recente. Se houver atualização, baixa, verifica e aplica o pacote antes de iniciar o jogo.
- Sem internet ou se a atualização falhar, a versão instalada continua disponível.
- O banco `backend/pokemon.db` e a configuração `.env` são preservados durante as atualizações.
- O inicializador evita conflitos de portas e duas instâncias simultâneas.

O arquivo **update-win-x64.zip** é usado pelo atualizador; para a primeira instalação, use o pacote completo. Os arquivos `.sha256` permitem conferir a integridade dos downloads.

Projeto de fã sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Veja os avisos de terceiros no pacote.
