/**
 * O retângulo de recorte que se arrasta por cima da foto.
 *
 * Vive à parte do resto do editor de propósito: arrastar um canto muda estado a
 * cada dedo movido, e essa avalanche de renders tem de ficar contida aqui em
 * baixo em vez de repintar a tela do Skia que está por trás.
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

type Grip = 'tl' | 'tr' | 'bl' | 'br' | 'move'

const MIN = 56          // lado mínimo do recorte, em pontos
const HANDLE = 44       // área de toque de cada canto

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

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

  // Recorte vindo de fora (mudou de foto, rodou, carregou em repor)
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

    if (grip === 'move') {
      write({
        x: clamp(s.x + dx, f.x, f.x + f.width - s.w),
        y: clamp(s.y + dy, f.y, f.y + f.height - s.h),
        w: s.w, h: s.h,
      })
      return
    }

    const pullsLeft = grip === 'tl' || grip === 'bl'
    const pullsTop  = grip === 'tl' || grip === 'tr'

    // O canto oposto fica preso; é dele que o retângulo cresce.
    const anchorX = pullsLeft ? s.x + s.w : s.x
    const anchorY = pullsTop  ? s.y + s.h : s.y
    const dirX = pullsLeft ? -1 : 1
    const dirY = pullsTop  ? -1 : 1

    const maxW = Math.max(1, dirX > 0 ? f.x + f.width - anchorX : anchorX - f.x)
    const maxH = Math.max(1, dirY > 0 ? f.y + f.height - anchorY : anchorY - f.y)

    let w = dirX > 0 ? s.w + dx : s.w - dx
    let h = dirY > 0 ? s.h + dy : s.h - dy

    if (asp != null) {
      // Puxar para lá do canto oposto daria lados negativos e, a seguir,
      // divisões que viram o retângulo do avesso. Nada abaixo de 1.
      w = Math.max(w, 1)
      h = Math.max(h, 1)
      // Dois eixos, um só rácio: manda o que o dedo puxou mais longe.
      w = Math.max(w, h * asp)
      h = w / asp
      const shrink = Math.min(1, maxW / w, maxH / h)
      w *= shrink
      h = w / asp
      const grow = Math.max(MIN / Math.max(w, 1), MIN / Math.max(h, 1))
      if (grow > 1) {
        w = Math.min(w * grow, maxW)
        h = w / asp
        if (h > maxH) { h = maxH; w = h * asp }
      }
    } else {
      w = clamp(w, Math.min(MIN, maxW), maxW)
      h = clamp(h, Math.min(MIN, maxH), maxH)
    }

    write({
      x: dirX > 0 ? anchorX : anchorX - w,
      y: dirY > 0 ? anchorY : anchorY - h,
      w, h,
    })
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
    }
  }, [drag])

  const { x, y, w, h } = rect
  const corner = (cx: number, cy: number) => ({
    position: 'absolute' as const,
    left: cx - HANDLE / 2,
    top: cy - HANDLE / 2,
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

      {/* Cantos — área de toque generosa, marca fina */}
      <View {...responders.tl.panHandlers} style={corner(x, y)}>
        <View style={[s.grip, s.gripTL]} pointerEvents="none" />
      </View>
      <View {...responders.tr.panHandlers} style={corner(x + w, y)}>
        <View style={[s.grip, s.gripTR]} pointerEvents="none" />
      </View>
      <View {...responders.bl.panHandlers} style={corner(x, y + h)}>
        <View style={[s.grip, s.gripBL]} pointerEvents="none" />
      </View>
      <View {...responders.br.panHandlers} style={corner(x + w, y + h)}>
        <View style={[s.grip, s.gripBR]} pointerEvents="none" />
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

  grip:   { position: 'absolute', width: 22, height: 22, borderColor: '#FFFFFF' },
  gripTL: { top: HANDLE / 2 - 2, left: HANDLE / 2 - 2, borderTopWidth: 3, borderLeftWidth: 3 },
  gripTR: { top: HANDLE / 2 - 2, right: HANDLE / 2 - 2, borderTopWidth: 3, borderRightWidth: 3 },
  gripBL: { bottom: HANDLE / 2 - 2, left: HANDLE / 2 - 2, borderBottomWidth: 3, borderLeftWidth: 3 },
  gripBR: { bottom: HANDLE / 2 - 2, right: HANDLE / 2 - 2, borderBottomWidth: 3, borderRightWidth: 3 },
})
