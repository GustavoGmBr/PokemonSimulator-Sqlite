Esta versão corrige a instalação automática das atualizações e adiciona IVs aos Pokémon.

## Escolha seu download

- **PokemonSimulator-v0.2.3-compact-win-x64.zip**: jogo com runtime e inicializador, sem sprites Pokémon. Baixa e verifica as sprites no primeiro início (aproximadamente 938 MB); depois funciona offline.
- **PokemonSimulator-v0.2.3-complete-win-x64.zip**: inclui todas as 13.932 sprites e funciona offline desde a primeira abertura.
- **PokemonSimulator-v0.2.3-update-win-x64.zip**: pacote utilizado pelo atualizador automático; reaproveita as sprites e preserva os saves e a configuração local.

Extraia todos os arquivos e abra **PokemonSimulator.exe**. Não é necessário Node.js instalado, CMD ou login.

**Se o inicializador anterior fica baixando a atualização repetidamente:** feche o jogo, faça uma cópia de segurança de `backend/pokemon.db` e extraia a edição compacta desta versão sobre a pasta existente, substituindo os arquivos. Não apague a pasta nem seu banco. O pacote não contém saves pessoais ou `.env`; as sprites existentes são reaproveitadas. O inicializador corrigido passa a instalar as próximas atualizações automaticamente.

## Atualizações automáticas

Corrigido o argumento do caminho do jogo no Windows: a barra final da pasta podia invalidar a passagem para o instalador depois do download. O novo launcher usa o instalador incluído no pacote verificado e só encerra após receber a confirmação de início. Uma janela mostra a descompactação e a instalação antes de reabrir o jogo. Falhas mantêm a versão anterior disponível e ficam registradas em `launcher/update.log`.

## IVs

- Seis IVs de **0 a 31**, total máximo **186**, sorteados em novos encontros e preservados ao capturar, evoluir, transformar e subir de nível. Os IVs influenciam os atributos de combate. **Iniciais sempre perfeitos (100%)**.
- Estrelas no encontro; valores como **HP: 31 | 31**, soma, porcentagem e estrelas na coleção e nos detalhes.
- **0☆:** 0–90; **1★:** 91–120; **2★★:** 121–150; **3★★★:** 151–185; **4★★★★ 🔴:** 186, potencial perfeito.
- Filtros na coleção por estrelas e porcentagem mínima/máxima de IVs.
- Bônus no valor do Pokémon: **+50% para 3 estrelas** e **+100% para 4 estrelas**, inclusive no valor usado em apostas do cassino.
- Seis **Essências de IV**, uma por atributo: +1 IV permanente, limitado a 31. Disponíveis na loja (5.000 ₽), loja do cassino (1.000 fichas), missões e torneios. Use na aba **Atributos** dos detalhes, fora de batalha; atributos no máximo não consomem itens.
- Migração automática do SQLite. Pokémon antigos recebem 15 IVs por atributo, conservando o cálculo anterior; o inicial antigo identificável recebe IVs perfeitos, inclusive quando já evoluído. Saves e Pokémon existentes são preservados.

Os intervalos de nível dos encontros conforme desafios e última geração liberada continuam disponíveis.

Projeto de fã sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Veja os avisos de terceiros no pacote.
