-- Fonte escolhida numa publicação de texto.
--
-- Guarda-se a chave curta ('script', 'hand'), nunca o nome da família nem o
-- ficheiro. Assim trocar o TTF de uma fonte — ou o seu peso — é um deploy da
-- app, não uma migração de dados.
--
-- Anulável de propósito: NULL significa a fonte de sempre (Jakarta Bold). Os
-- posts anteriores a isto ficam corretos sem backfill nenhum, e um cliente
-- antigo que não envie o campo continua a publicar normalmente.
--
-- A validação da chave vive no controlador, contra uma whitelist. A coluna é
-- texto livre por comodidade do Prisma, mas nada além dessa whitelist lá entra.

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "fontKey" TEXT;
