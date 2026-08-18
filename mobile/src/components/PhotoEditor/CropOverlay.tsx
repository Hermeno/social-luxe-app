/**
 * O retângulo de recorte que se arrasta por cima da foto.
 *
 * Oito pegas: quatro cantos e quatro lados. Puxar um lado mexe só naquele lado
 * — é o gesto que toda a gente tenta primeiro para "baixar o topo" ou "apertar
 * a direita". Com um formato fixo os lados desaparecem: um rácio preso não
 * sobrevive a um lado a mexer sozinho, e uma pega que não obedece é pior do que
 * pega nenhuma.
 *
 * Vive à parte do resto do editor de propósito: arrastar muda estado a cada
 * dedo movido, e essa avalanche de renders tem de ficar contida aqui em baixo
 * em vez de repintar a tela do Skia que está por trás.
 *
 * Usa PanResponder — o gesto tem de funcionar dentro de um Modal, onde o
 * gesture-handler precisaria de raiz própria, e o worklets do Reanimated não
 * está ligado no babel deste projeto.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import type { CropRect } from './edits'

export interface Frame { x: number; y: number; width: number; height: number }

interface PxRect { x: number; y: number; w: number; h: number }

interface Props {
  frame: Frame
  crop: CropRect
  /** null = livre. Caso contrário largura ÷ altura. */
  aspect: number | null
  onChange: (crop: CropRect) => void
}

type Grip = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move'

/** Que lados do retângulo cada pega arrasta. */
const PULLS: Record<Exclude<Grip, 'move'>, { l: boolean; r: boolean; t: boolean; b: boolean }> = {
  tl: { l: true,  r: false, t: true,  b: false },
  tr: { l: false, r: true,  t: true,  b: false },
  bl: { l: true,  r: false, t: false, b: true  },
  br: { l: false, r: true,  t: false, b: true  },
  t:  { l: false, r: false, t: true,  b: false },
  b:  { l: false, r: false, t: false, b: true  },
  l:  { l: true,  r: false, t: false, b: false },
  r:  { l: false, r: true,  t: false, b: false },
}

const MIN = 56      // lado mínimo do recorte, em pontos
const HANDLE = 46   // lado da área de toque de um canto
// A pega fica com um terço de fora e dois terços de dentro. Toda para fora
// ficaria cortada pela beira do ecrã quando a foto o enche — e uma pega que
// não se pode tocar é o mesmo que não existir.
const OUT = 14

/** Aperta um valor entre dois limites, mesmo que venham trocados. */
function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo
  return Math.min(Math.max(v, lo), hi)
}

function toPx(c: CropRect, f: Frame): PxRect {
  return { x: f.x + c.x * f.width, y: f.y + c.y * f.height, w: c.w * f.width, h: c.h * f.height }
}

function toCrop(r: PxRect, f: Frame): CropRect {
  const x = clamp((r.x - f.x) / f.width, 0, 1)
  const y = clamp((r.y - f.y) / f.height, 0, 1)
  return {
    x, y,
    w: clamp(r.w / f.width, 0.01, 1 - x),
    h: clamp(r.h / f.height, 0.01, 1 - y),
  }
}

export default function CropOverlay({ frame, crop, aspect, onChange }: Props) {
  const [rect, setRect] = useState<PxRect>(() => toPx(crop, frame))

  // Os gestos são criados uma vez e vivem toda a vida do componente; tudo o que
  // eles precisam de saber tem de estar em refs, senão leem o primeiro render.
  const rectRef   = useRef(rect)
  const startRef  = useRef(rect)
  const frameRef  = useRef(frame)
  const aspectRef = useRef(aspect)
  const onChangeRef = useRef(onChange)

  frameRef.current = frame
  aspectRef.current = aspect
  onChangeRef.current = onChange

  const write = useCallback((r: PxRect) => { rectRef.current = r; setRect(r) }, [])

  // Recorte vindo de fora (mudou de foto, rodou, escolheu formato, repôs)
  useEffect(() => {
    const next = toPx(crop, frame)
    const cur = rectRef.current
    const same =
      Math.abs(next.x - cur.x) < 0.5 && Math.abs(next.y - cur.y) < 0.5 &&
      Math.abs(next.w - cur.w) < 0.5 && Math.abs(next.h - cur.h) < 0.5
    if (!same) write(next)
  }, [crop, frame.x, frame.y, frame.width, frame.height, write])

  const drag = useCallback((grip: Grip, dx: number, dy: number) => {
    const s = startRef.current
    const f = frameRef.current
    const asp = aspectRef.current

    const fl = f.x
    const ft = f.y
    const fr = f.x + f.width
    const fb = f.y + f.height

    if (grip === 'move') {
      write({
        x: clamp(s.x + dx, fl, fr - s.w),
        y: clamp(s.y + dy, ft, fb - s.h),
        w: s.w, h: s.h,
      })
      return
    }

    const pulls = PULLS[grip]
    let left   = s.x
    let top    = s.y
    let right  = s.x + s.w
    let bottom = s.y + s.h

    if (pulls.l) left   = clamp(s.x + dx,       fl,        right - MIN)
    if (pulls.r) right  = clamp(s.x + s.w + dx, left + MIN, fr)
    if (pulls.t) top    = clamp(s.y + dy,       ft,        bottom - MIN)
    if (pulls.b) bottom = clamp(s.y + s.h + dy, top + MIN,  fb)

    // Com o rácio preso só há cantos, e o canto oposto fica ancorado. Manda o
    // eixo em que o dedo andou mais: arrastar para o lado governa a largura,
    // arrastar para cima ou para baixo governa a altura. O outro segue.
    if (asp !== null) {
      let w: number
      let h: number
      if (Math.abs(dx) >= Math.abs(dy)) {
        w = Math.max(right - left, 1)
        h = w / asp
      } else {
        h = Math.max(bottom - top, 1)
        w = h * asp
      }

      const maxW = Math.max(1, pulls.l ? right - fl : fr - left)
      const maxH = Math.max(1, pulls.t ? bottom - ft : fb - top)
      w = Math.min(w, maxW, maxH * asp)
      h = w / asp

      if (w < MIN || h < MIN) {
        w = Math.min(Math.max(MIN, MIN * asp), maxW, maxH * asp)
        h = w / asp
      }

      if (pulls.l) left = right - w
      else right = left + w
      if (pulls.t) top = bottom - h
      else bottom = top + h
    }

    write({ x: left, y: top, w: right - left, h: bottom - top })
  }, [write])

  const responders = useMemo(() => {
    const build = (grip: Grip) => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { startRef.current = rectRef.current },
      onPanResponderMove: (_e, g) => drag(grip, g.dx, g.dy),
      onPanResponderRelease: () => onChangeRef.current(toCrop(rectRef.current, frameRef.current)),
      onPanResponderTerminate: () => onChangeRef.current(toCrop(rectRef.current, frameRef.current)),
    })
    return {
      move: build('move'),
      tl: build('tl'), tr: build('tr'), bl: build('bl'), br: build('br'),
      t: build('t'), b: build('b'), l: build('l'), r: build('r'),
    }
  }, [drag])

  const { x, y, w, h } = rect
  const sides = aspect === null

  // Os lados ficam entre os cantos, para não haver duas pegas no mesmo sítio.
  const barW = Math.max(0, w - HANDLE * 1.6)
  const barH = Math.max(0, h - HANDLE * 1.6)

  const cornerBox = (cx: number, cy: number, insetX: 1 | -1, insetY: 1 | -1) => ({
    position: 'absolute' as const,
    left: cx - (insetX > 0 ? OUT : HANDLE - OUT),
    top:  cy - (insetY > 0 ? OUT : HANDLE - OUT),
    width: HANDLE,
    height: HANDLE,
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Escurecer tudo o que fica de fora — quatro faixas em vez de um buraco,
          porque o RN não recorta uma view pelo negativo. */}
      <View pointerEvents="none" style={[s.dim, { left: 0, right: 0, top: 0, height: Math.max(0, y) }]} />
      <View pointerEvents="none" style={[s.dim, { left: 0, right: 0, top: y + h, bottom: 0 }]} />
      <View pointerEvents="none" style={[s.dim, { left: 0, width: Math.max(0, x), top: y, height: h }]} />
      <View pointerEvents="none" style={[s.dim, { left: x + w, right: 0, top: y, height: h }]} />

      {/* Corpo — arrastar move o recorte inteiro */}
      <View
        {...responders.move.panHandlers}
        style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
      >
        <View style={s.border} pointerEvents="none" />
        <View pointerEvents="none" style={[s.gridV, { left: w / 3 }]} />
        <View pointerEvents="none" style={[s.gridV, { left: (w * 2) / 3 }]} />
        <View pointerEvents="none" style={[s.gridH, { top: h / 3 }]} />
        <View pointerEvents="none" style={[s.gridH, { top: (h * 2) / 3 }]} />
      </View>

      {/* Lados — só com formato livre, onde um lado pode mexer-se sozinho */}
      {sides && barW > 0 && (
        <>
          <View
            {...responders.t.panHandlers}
            style={{ position: 'absolute', left: x + (w - barW) / 2, top: y - OUT, width: barW, height: HANDLE }}
          >
            <View style={[s.barH, { top: OUT - 1.5 }]} pointerEvents="none" />
          </View>
          <View
            {...responders.b.panHandlers}
            style={{ position: 'absolute', left: x + (w - barW) / 2, top: y + h - (HANDLE - OUT), width: barW, height: HANDLE }}
          >
            <View style={[s.barH, { top: HANDLE - OUT - 1.5 }]} pointerEvents="none" />
          </View>
        </>
      )}
      {sides && barH > 0 && (
        <>
          <View
            {...responders.l.panHandlers}
            style={{ position: 'absolute', left: x - OUT, top: y + (h - barH) / 2, width: HANDLE, height: barH }}
          >
            <View style={[s.barV, { left: OUT - 1.5 }]} pointerEvents="none" />
          </View>
          <View
            {...responders.r.panHandlers}
            style={{ position: 'absolute', left: x + w - (HANDLE - OUT), top: y + (h - barH) / 2, width: HANDLE, height: barH }}
          >
            <View style={[s.barV, { left: HANDLE - OUT - 1.5 }]} pointerEvents="none" />
          </View>
        </>
      )}

      {/* Cantos — sempre presentes, e sempre por cima dos lados */}
      <View {...responders.tl.panHandlers} style={cornerBox(x, y, 1, 1)}>
        <View style={[s.grip, { top: OUT - 1.5, left: OUT - 1.5, borderTopWidth: 3, borderLeftWidth: 3 }]} pointerEvents="none" />
      </View>
      <View {...responders.tr.panHandlers} style={cornerBox(x + w, y, -1, 1)}>
        <View style={[s.grip, { top: OUT - 1.5, right: OUT - 1.5, borderTopWidth: 3, borderRightWidth: 3 }]} pointerEvents="none" />
      </View>
      <View {...responders.bl.panHandlers} style={cornerBox(x, y + h, 1, -1)}>
        <View style={[s.grip, { bottom: OUT - 1.5, left: OUT - 1.5, borderBottomWidth: 3, borderLeftWidth: 3 }]} pointerEvents="none" />
      </View>
      <View {...responders.br.panHandlers} style={cornerBox(x + w, y + h, -1, -1)}>
        <View style={[s.grip, { bottom: OUT - 1.5, right: OUT - 1.5, borderBottomWidth: 3, borderRightWidth: 3 }]} pointerEvents="none" />
      </View>
    </View>
  )
}

const LINE = 'rgba(255,255,255,0.34)'

const s = StyleSheet.create({
  dim:    { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.58)' },
  border: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  gridV:  { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: LINE },
  gridH:  { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },

  grip:   { position: 'absolute', width: 24, height: 24, borderColor: '#FFFFFF' },
  barH:   { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#FFFFFF' },
  barV:   { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: '#FFFFFF' },
})
