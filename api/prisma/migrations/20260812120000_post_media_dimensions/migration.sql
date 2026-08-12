-- Dimensões originais da media do post.
--
-- Porquê: a app precisa da proporção da imagem ANTES de a descarregar. Sem isso
-- desenha-a à altura toda, descobre a proporção no `onLoad` e encolhe — um
-- salto de layout que se lê como um piscar, e que em carrosséis acontecia duas
-- vezes por foto por causa da reciclagem de slides.
--
-- Tudo anulável: posts anteriores ficam sem dimensões e a app trata-os com o
-- enquadramento cheio de sempre. Como os posts expiram em 24h, o caso antigo
-- desaparece sozinho dentro de um dia.

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "mediaWidth"  INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "mediaHeight" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "mediaSizes"  JSONB;
