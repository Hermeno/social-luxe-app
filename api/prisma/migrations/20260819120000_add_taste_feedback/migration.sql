-- Sinal de gosto da feed — o que alimenta o algoritmo.
--
-- Sem chave estrangeira para "Post" de propósito: as publicações são efémeras
-- e o cleanup apaga-as em definitivo. Se o sinal dependesse delas, o histórico
-- de treino durava horas. Por isso "postId", "authorId" e "mediaType" ficam
-- gravados aqui como valores — o sinal sobrevive à publicação que o originou.

CREATE TYPE "TasteSignal" AS ENUM ('MORE', 'LESS');

CREATE TABLE "TasteFeedback" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "signal"    "TasteSignal" NOT NULL,
  "dwellMs"   INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TasteFeedback_pkey" PRIMARY KEY ("id")
);

-- Uma resposta por pessoa por conteúdo: mudar de ideias substitui a anterior.
CREATE UNIQUE INDEX "TasteFeedback_userId_postId_key" ON "TasteFeedback"("userId", "postId");

-- Leitura do perfil de gosto de uma pessoa, do mais recente para trás.
CREATE INDEX "TasteFeedback_userId_createdAt_idx" ON "TasteFeedback"("userId", "createdAt");

-- Leitura pelo lado de quem publica: quanto do que este autor faz agrada.
CREATE INDEX "TasteFeedback_authorId_signal_idx" ON "TasteFeedback"("authorId", "signal");

ALTER TABLE "TasteFeedback"
  ADD CONSTRAINT "TasteFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
