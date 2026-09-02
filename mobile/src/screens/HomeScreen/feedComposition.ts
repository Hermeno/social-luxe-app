import type { Post } from '../../types'
import { readPost } from './homePostShape'

/**
 * O ritmo da Home.
 *
 * A lista deixa de ser uma publicação por linha e passa a ser um BLOCO por
 * linha. Há três registos e o feed alterna entre eles:
 *
 *   circle  a composição de discos, sempre sozinha — é a assinatura
 *   hero    uma publicação de ponta a ponta, com a altura que a mídia pedir
 *   rail    várias em fila horizontal, deitadas, que se arrastam para o lado
 *
 * O que decide o registo é a FORMA DA MÍDIA, não um contador nem um sorteio.
 * Uma fotografia ao alto não cabe num cartão deitado sem se perder metade dela;
 * uma paisagem, essa, pede exactamente isso — e lado a lado convida ao arrasto.
 * Assim a alternância nasce do conteúdo real e não de uma regra imposta por
 * cima: um feed com muitos retratos respira em heróis, um com muitas paisagens
 * anda em filas, e nenhum dos dois precisa de saber a que altura da lista está.
 *
 * É determinístico e sem estado: a mesma publicação cai sempre no mesmo registo,
 * em qualquer telefone e a qualquer momento — o mesmo princípio que a composição
 * do Círculo já segue. Recarregar a Home não baralha a página.
 */

/** Uma fila com um só cartão não é uma fila: é um cartão recortado à toa. */
const RAIL_MIN = 2

/**
 * Quantos cartões, no máximo, antes de abrir outra fila.
 *
 * Não é um limite técnico — a fila arrasta o que lhe puserem. É de ritmo: uma
 * fila longa passa a ser um catálogo, e a Home deixa de alternar registos para
 * ser uma prateleira só. Ao quarto cartão a fila fecha e o que vier a seguir
 * recomeça, dando à página a hipótese de mudar de respiração.
 */
const RAIL_MAX = 4

/**
 * Abaixo disto a mídia está ao alto e vai para herói.
 *
 * 1.0 seria o quadrado exacto, mas uma imagem quadrada ainda se lê bem deitada
 * — o corte de 16:9 sobre um quadrado tira as bordas, não o assunto. 0.95 deixa
 * o quadrado passar para a fila e manda para herói só o que é mesmo vertical.
 */
const PORTRAIT_BELOW = 0.95

/**
 * Proporção assumida quando o servidor não mandou dimensões.
 *
 * São os mesmos números que o `HomeFeedItem` já usa para desenhar nesse caso —
 * e têm de ser os mesmos, senão a composição decidia "isto é paisagem" e o
 * desenho abria-a ao alto. Um vídeo sem medidas nasce deitado, uma fotografia
 * sem medidas nasce ao alto.
 */
const FALLBACK_ASPECT = { video: 16 / 9, image: 4 / 5 } as const

export type HomeBlock =
  | { kind: 'circle'; id: string; post: Post }
  | { kind: 'hero'; id: string; post: Post }
  | { kind: 'rail'; id: string; posts: Post[] }

/** Proporção da mídia: do servidor quando existe, do registo quando não. */
export function postAspect(post: Post): number {
  const w = post.mediaWidth
  const h = post.mediaHeight
  if (w && h && h > 0) {
    const ratio = w / h
    if (Number.isFinite(ratio) && ratio > 0) return ratio
  }
  return post.mediaType === 'VIDEO' ? FALLBACK_ASPECT.video : FALLBACK_ASPECT.image
}

/**
 * O registo de uma publicação, olhada sozinha.
 *
 * `rail` aqui é só uma candidatura: uma paisagem isolada entre dois retratos
 * não tem com quem fazer fila e acaba em herói — quem decide isso é o
 * agrupamento, que já vê as vizinhas.
 */
function registerOf(post: Post): 'circle' | 'hero' | 'rail' {
  if (readPost(post).kind === 'circle') return 'circle'
  // Sem mídia não há forma que se possa deitar: o texto é sempre herói.
  if (post.mediaType === 'TEXT' || !post.mediaUrl) return 'hero'
  return postAspect(post) < PORTRAIT_BELOW ? 'hero' : 'rail'
}

/**
 * Agrupa as publicações em blocos, pela ordem em que vieram.
 *
 * A ordem NUNCA muda: um feed é uma cronologia e trocar posições para encher
 * uma fila mentia sobre o que é mais recente. As filas formam-se só com
 * paisagens que já estavam seguidas.
 */
export function composeHomeFeed(posts: Post[]): HomeBlock[] {
  const blocks: HomeBlock[] = []
  let run: Post[] = []

  const flushRun = () => {
    if (run.length === 0) return
    // Uma paisagem sozinha vira herói: ao menos vê-se inteira.
    if (run.length < RAIL_MIN) {
      for (const post of run) blocks.push({ kind: 'hero', id: post.id, post })
    } else {
      blocks.push({ kind: 'rail', id: `rail:${run[0].id}:${run.length}`, posts: run })
    }
    run = []
  }

  for (const post of posts) {
    const register = registerOf(post)
    if (register === 'rail') {
      run.push(post)
      if (run.length === RAIL_MAX) flushRun()
      continue
    }
    flushRun()
    blocks.push({ kind: register, id: post.id, post })
  }
  flushRun()

  return blocks
}

/** Todas as publicações de um bloco, para quem precisa de percorrer o feed. */
export function blockPosts(block: HomeBlock): Post[] {
  return block.kind === 'rail' ? block.posts : [block.post]
}
