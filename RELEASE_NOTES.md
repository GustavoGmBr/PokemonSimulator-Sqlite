Correção do primeiro início e dos conflitos com outros sistemas no mesmo computador.

Baixe **PokemonSimulator-v0.2.1-win-x64.zip**, extraia todos os arquivos e abra **PokemonSimulator.exe**. Node.js já vem incluído no ZIP; não é necessário abrir CMD. Na primeira execução, mantenha a internet conectada para baixar aproximadamente 938 MB de sprites. O inicializador mostra o progresso e verifica a integridade antes de instalar. Depois disso, o jogo funciona offline.

- O clone do repositório agora inclui `PokemonSimulator.exe` e o atualizador. No clone, Node.js 22.12+ precisa estar instalado; o inicializador prepara as dependências e as imagens.
- As portas padrão são 34435 para a API e 35185 para a interface de desenvolvimento. Se estiverem ocupadas, o inicializador escolhe outras sem enviar requisições ao serviço existente.
- A interface usa a API da própria instância. Configurações antigas de `VITE_API_ORIGIN` não direcionam mais o jogo para outros sistemas.
- A primeira tela continua sendo o gerenciamento de saves locais, sem login.
- Sprites existentes e íntegras são reaproveitadas. Arquivos ausentes são recuperados no início quando houver internet.
- Atualizações preservam `backend/pokemon.db`, `.env` e os saves.

O arquivo **update-win-x64.zip** é usado pelo atualizador. O `.tar.gz` de sprites é baixado automaticamente; não precisa ser extraído manualmente. Os arquivos `.sha256` permitem conferir a integridade dos downloads.

Projeto de fã sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Veja os avisos de terceiros no pacote.
