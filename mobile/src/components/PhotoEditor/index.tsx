/**
 * Editor de fotografias — entre escolher e publicar.
 *
 * Serve uma foto ou vinte: cada uma guarda a sua própria edição e a tira de
 * miniaturas em baixo salta de uma para a outra sem perder nada. Só ao carregar
 * em Concluir é que os ficheiros são realmente gerados.
 *
 * A tela é Skia porque a nitidez precisa de ler os pixéis vizinhos — coisa que
 * nenhum estilo de React Native faz. O mesmo shader desenha a pré-visualização
 * e o ficheiro final, por isso o que se vê aqui é o que vai publicado.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Canvas, ImageShader, Rect, Shader, Skia, type SkImage,
} from '@shopify/react-native-skia'
import { fonts } from '../../theme'
import { useT } from '../../i18n'
import { toast } from '../../utils/toast'
import CropOverlay from './CropOverlay'
import Slider from './Slider'
import {
  ADJUST_ORDER, ADJUST_RANGE, ASPECTS, NO_EDIT, PRESETS,
  type AdjustKey, type CropRect, type PhotoEdit, type Rotation,
  centeredCrop, effect, flipCrop, isUntouched, newEdit, ratioFor, rotateCrop, uniformsFor,
} from './edits'
import { PREVIEW_SIDE, decode, limit, orient, crop, renderToFile } from './render'

interface Props {
  visible: boolean
  photos: string[]
  onCancel: () => void
  onDone: (uris: string[]) => void
}

type Tab = 'crop' | 'adjust' | 'filter'

const ACCENT = '#FF7A1C'
const THUMB  = 64

function fitRect(iw: number, ih: number, boxW: number, boxH: number) {
  const k = Math.min(boxW / iw, boxH / ih)
  const width = iw * k
  const height = ih * k
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height }
}

export default function PhotoEditor({ visible, photos, onCancel, onDone }: Props) {
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  const fx = useMemo(() => effect(), [])
  const canColor = fx !== null

  const [index,   setIndex]   = useState(0)
  const [edits,   setEdits]   = useState<PhotoEdit[]>([])
  const [aspects, setAspects] = useState<string[]>([])
  const [tab,     setTab]     = useState<Tab>('crop')
  const [knob,    setKnob]    = useState<AdjustKey>('sharpen')
  const [stage,   setStage]   = useState({ w: 0, h: 0 })
  const [base,    setBase]    = useState<SkImage | null>(null)
  const [broken,  setBroken]  = useState(false)
  const [step,    setStep]    = useState(0)      // 0 = parado; senão foto a ser gerada

  // Descodificar é o passo caro. Cada foto passa por ele uma vez por sessão,
  // mesmo que a pessoa ande para trás e para a frente na tira de baixo.
  const decoded = useRef(new Map<string, SkImage>())
  // O tamanho é leve e não se deita fora: no fim é ele que diz com que largura
  // cada foto esteve no ecrã, mesmo que a imagem já tenha saído da memória.
  const dims = useRef(new Map<string, { w: number; h: number }>())
  const signature = photos.join('|')

  useEffect(() => {
    if (!visible) return
    setEdits(photos.map(() => newEdit()))
    setAspects(photos.map(() => 'free'))
    setIndex(0)
    setTab('crop')
    setKnob('sharpen')
    setBroken(false)
    setStep(0)
  }, [visible, signature])

  useEffect(() => {
    if (visible) return
    decoded.current.clear()
    dims.current.clear()
  }, [visible])

  const uri = photos[index]

  useEffect(() => {
    if (!visible || !uri) return
    const hit = decoded.current.get(uri)
    if (hit) { setBase(hit); return }

    let dropped = false
    setBase(null)
    decode(uri)
      // Reduzir é só para poupar memória — se falhar, mostra-se a foto inteira
      // em vez de deixar o editor vazio.
      .then((img) => { try { return limit(img, PREVIEW_SIDE) } catch { return img } })
      .then((img) => {
        if (dropped) return
        // Um álbum de dez fotos descodificadas são dezenas de MB em memória.
        // Guardam-se as últimas; voltar a uma anterior só custa descodificar.
        while (decoded.current.size >= 6) {
          const oldest = decoded.current.keys().next().value
          if (oldest === undefined) break
          decoded.current.delete(oldest)
        }
        decoded.current.set(uri, img)
        dims.current.set(uri, { w: img.width(), h: img.height() })
        setBase(img)
      })
      .catch(() => { if (!dropped) setBroken(true) })
    return () => { dropped = true }
  }, [visible, uri])

  const edit = edits[index] ?? NO_EDIT
  const aspectId = aspects[index] ?? 'free'

  // Rodar e espelhar ficam gravados numa imagem própria: o recorte a seguir
  // trabalha sempre sobre uma foto já direita, e as coordenadas que a pessoa
  // arrasta são exatamente as que saem no ficheiro.
  // Cada passo cai para o anterior se o Skia não conseguir a superfície: mais
  // vale um editor que só corta do que um retângulo preto sem nada dentro.
  const oriented = useMemo(() => {
    if (!base) return null
    try { return orient(base, edit.rotate, edit.flipH) } catch { return base }
  }, [base, edit.rotate, edit.flipH])

  const cropped = useMemo(() => {
    if (!oriented) return null
    try { return crop(oriented, edit.crop) } catch { return oriented }
  }, [oriented, edit.crop])

  // A cortar mostra-se a foto toda (é preciso ver o que fica de fora); nas
  // outras separadores mostra-se já o resultado.
  const shown = tab === 'crop' ? oriented : cropped
  const frame = useMemo(() => {
    if (!shown || stage.w <= 0 || stage.h <= 0) return null
    return fitRect(shown.width(), shown.height(), stage.w, stage.h)
  }, [shown, stage.w, stage.h])

  const patch = useCallback((fn: (e: PhotoEdit) => PhotoEdit) => {
    setEdits((prev) => prev.map((e, i) => (i === index ? fn(e) : e)))
  }, [index])

  const setCrop = useCallback((c: CropRect) => {
    patch((e) => ({ ...e, crop: c }))
  }, [patch])

  function turn(dir: -1 | 1) {
    if (!base) return
    patch((e) => {
      // `orient` roda e só depois espelha. Num espelho, rodar para a direita
      // vê-se ao contrário — somar 90 ao ângulo faria a foto virar para a
      // esquerda. Numa foto espelhada o ângulo anda para trás para que o botão
      // continue a fazer o que diz.
      const turned = e.flipH ? -dir : dir
      const rotate = ((((e.rotate + turned * 90) % 360) + 360) % 360) as Rotation
      const quarter = rotate === 90 || rotate === 270
      const w = quarter ? base.height() : base.width()
      const h = quarter ? base.width() : base.height()
      const ratio = ratioFor(aspectId, w, h)
      // Com um formato fixo o rácio manda: rodar volta a centrar o retângulo.
      const next = ratio === null ? rotateCrop(e.crop, dir) : centeredCrop(ratio, w, h)
      return { ...e, rotate, crop: next }
    })
  }

  function mirror() {
    patch((e) => ({ ...e, flipH: !e.flipH, crop: flipCrop(e.crop) }))
  }

  function chooseAspect(id: string) {
    setAspects((prev) => prev.map((a, i) => (i === index ? id : a)))
    if (!oriented) return
    const ratio = ratioFor(id, oriented.width(), oriented.height())
    // "Livre" solta o rácio mas não deita fora o recorte já feito.
    if (ratio === null) return
    patch((e) => ({ ...e, crop: centeredCrop(ratio, oriented.width(), oriented.height()) }))
  }

  function resetPhoto() {
    setAspects((prev) => prev.map((a, i) => (i === index ? 'free' : a)))
    patch(() => newEdit())
  }

  const busy = step > 0

  /**
   * Largura, em pontos, com que esta foto esteve no ecrã — é a régua da
   * nitidez. Quem não foi tocado nem chega a ser gerado, por isso todas as
   * fotos que interessam já passaram por aqui e estão descodificadas.
   */
  function previewWidthFor(i: number): number {
    const size = dims.current.get(photos[i])
    const e = edits[i]
    if (!size || !e || stage.w <= 0 || stage.h <= 0) return stage.w || PREVIEW_SIDE
    const quarter = e.rotate === 90 || e.rotate === 270
    const w = (quarter ? size.h : size.w) * e.crop.w
    const h = (quarter ? size.w : size.h) * e.crop.h
    return fitRect(w, h, stage.w, stage.h).width
  }

  async function finish() {
    if (busy) return
    try {
      const out: string[] = []
      for (let i = 0; i < photos.length; i++) {
        setStep(i + 1)
        // Dar um fôlego ao ecrã antes de bloquear o fio com o Skia, senão o
        // contador de progresso nunca chega a ser pintado.
        await new Promise((r) => setTimeout(r, 16))
        out.push(await renderToFile(photos[i], edits[i] ?? NO_EDIT, previewWidthFor(i)))
      }
      setStep(0)
      onDone(out)
    } catch {
      setStep(0)
      toast.error(t.error, t.pe_failed)
    }
  }

  const aspectRatio = oriented ? ratioFor(aspectId, oriented.width(), oriented.height()) : null
  const range = ADJUST_RANGE[knob]

  const tabs: { id: Tab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'crop',   icon: 'crop-outline',     label: t.pe_crop },
    { id: 'adjust', icon: 'options-outline',  label: t.pe_adjust },
    { id: 'filter', icon: 'color-wand-outline', label: t.pe_filters },
  ]
  const shownTabs = canColor ? tabs : tabs.slice(0, 1)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => { if (!busy) onCancel() }}
    >
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: top }]}>
          <TouchableOpacity
            style={s.headerSide}
            onPress={onCancel}
            disabled={busy}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={s.cancel}>{t.cancel}</Text>
          </TouchableOpacity>

          <View style={s.headerIdentity} pointerEvents="none">
            <View style={s.brandSignal}>
              <View style={s.brandSignalLine} />
              <View style={s.brandSignalDot} />
            </View>
            <Text style={s.title}>
              {photos.length > 1 ? `${t.pe_title} · ${index + 1}/${photos.length}` : t.pe_title}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.headerSide, s.headerSideEnd]}
            onPress={finish}
            disabled={busy}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={t.pe_done}
            accessibilityState={{ disabled: busy, busy }}
          >
            {busy
              ? <ActivityIndicator color={ACCENT} size="small" />
              : <Text style={s.done}>{t.pe_done}</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Tela ── */}
        <View
          style={s.stage}
          onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {broken ? (
            <Text style={s.brokenTxt}>{t.pe_failed}</Text>
          ) : shown && frame && stage.w > 0 ? (
            <>
              <Canvas style={{ width: stage.w, height: stage.h }}>
                <Rect x={frame.x} y={frame.y} width={frame.width} height={frame.height}>
                  {fx ? (
                    <Shader source={fx} uniforms={uniformsFor(edit.adjust, frame, 1)}>
                      <ImageShader
                        image={shown}
                        fit="fill"
                        rect={Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height)}
                        tx="clamp"
                        ty="clamp"
                      />
                    </Shader>
                  ) : (
                    <ImageShader
                      image={shown}
                      fit="fill"
                      rect={Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height)}
                      tx="clamp"
                      ty="clamp"
                    />
                  )}
                </Rect>
              </Canvas>

              {tab === 'crop' && (
                <CropOverlay
                  frame={frame}
                  crop={edit.crop}
                  aspect={aspectRatio}
                  onChange={setCrop}
                />
              )}
            </>
          ) : (
            <ActivityIndicator color={ACCENT} />
          )}
        </View>

        {/* ── Tira de fotos — só faz sentido quando há mais do que uma ── */}
        {photos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.strip}
            scrollEnabled={!busy}
          >
            {photos.map((p, i) => (
              <Pressable
                key={`${p}-${i}`}
                onPress={() => setIndex(i)}
                disabled={busy}
                style={[s.stripCell, i === index && s.stripCellOn]}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}/${photos.length}`}
                accessibilityState={{ selected: i === index, disabled: busy }}
              >
                <Image source={{ uri: p }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {!isUntouched(edits[i] ?? NO_EDIT) && <View style={s.stripDot} />}
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── Painel do separador ativo ── */}
        <View style={s.panel}>
          {tab === 'crop' && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                {ASPECTS.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.chip, aspectId === a.id && s.chipOn]}
                    onPress={() => chooseAspect(a.id)}
                    disabled={busy}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aspectId === a.id, disabled: busy }}
                  >
                    <Text style={[s.chipTxt, aspectId === a.id && s.chipTxtOn]}>
                      {t[`pe_a_${a.id}` as keyof typeof t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={s.tools}>
                <Tool icon="return-up-back" label={t.pe_rotateLeft}  onPress={() => turn(-1)} disabled={busy} />
                <Tool icon="return-up-forward" label={t.pe_rotateRight} onPress={() => turn(1)} disabled={busy} />
                <Tool icon="swap-horizontal" label={t.pe_flip} onPress={mirror} disabled={busy} />
                <Tool icon="refresh" label={t.pe_reset} onPress={resetPhoto} disabled={busy || isUntouched(edit)} />
              </View>
            </>
          )}

          {tab === 'adjust' && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                {ADJUST_ORDER.map((k) => {
                  const on = knob === k
                  const moved = Math.abs(edit.adjust[k]) > 0.0005
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[s.chip, on && s.chipOn]}
                      onPress={() => setKnob(k)}
                      disabled={busy}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: busy }}
                    >
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                        {t[`pe_${k}` as keyof typeof t]}
                      </Text>
                      {moved && <View style={[s.chipDot, on && s.chipDotOn]} />}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <View style={s.sliderRow}>
                <Text style={s.sliderLabel}>{t[`pe_${knob}` as keyof typeof t]}</Text>
                <Text style={s.sliderValue}>
                  {Math.round((edit.adjust[knob] / (range.max || 1)) * 100)}
                </Text>
              </View>
              <View style={s.sliderWrap}>
                <Slider
                  value={edit.adjust[knob]}
                  min={range.min}
                  max={range.max}
                  bipolar={range.min < 0}
                  onChange={(v) => patch((e) => ({
                    ...e, preset: 'custom', adjust: { ...e.adjust, [knob]: v },
                  }))}
                />
              </View>
            </>
          )}

          {tab === 'filter' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => patch((e) => ({ ...e, preset: p.id, adjust: { ...p.adjust } }))}
                  disabled={busy}
                  activeOpacity={0.8}
                  style={s.filterCell}
                  accessibilityRole="button"
                  accessibilityState={{ selected: edit.preset === p.id, disabled: busy }}
                >
                  <View style={[s.filterThumb, edit.preset === p.id && s.filterThumbOn]}>
                    {fx && cropped && (
                      <Canvas style={{ width: THUMB, height: THUMB }}>
                        <Rect x={0} y={0} width={THUMB} height={THUMB}>
                          <Shader
                            source={fx}
                            uniforms={uniformsFor(p.adjust, { x: 0, y: 0, width: THUMB, height: THUMB }, 1)}
                          >
                            <ImageShader
                              image={cropped}
                              fit="cover"
                              rect={Skia.XYWHRect(0, 0, THUMB, THUMB)}
                              tx="clamp"
                              ty="clamp"
                            />
                          </Shader>
                        </Rect>
                      </Canvas>
                    )}
                  </View>
                  <Text style={[s.filterTxt, edit.preset === p.id && s.filterTxtOn]}>
                    {t[`pe_f_${p.id}` as keyof typeof t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Separadores ── */}
        <View style={[s.tabs, { paddingBottom: bottom || 10 }]}>
          {shownTabs.map((it) => {
            const on = tab === it.id
            return (
              <TouchableOpacity
                key={it.id}
                style={s.tab}
                onPress={() => setTab(it.id)}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: busy }}
              >
                <Ionicons name={it.icon} size={20} color={on ? ACCENT : '#8A8A90'} />
                <Text style={[s.tabTxt, on && s.tabTxtOn]}>{it.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {busy && (
          <View style={s.busy} pointerEvents="auto">
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={s.busyTxt}>
              {photos.length > 1 ? `${t.pe_applying} ${step}/${photos.length}` : t.pe_applying}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

function Tool({ icon, label, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      style={[s.tool, disabled && s.toolOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
      <Text style={s.toolTxt} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C0D0E' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#26282B',
  },
  headerSide: { width: 96, height: 52, paddingHorizontal: 16, justifyContent: 'center' },
  headerSideEnd: { alignItems: 'flex-end' },
  headerIdentity: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 5 },
  brandSignal: { height: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandSignalLine: { width: 18, height: 2, backgroundColor: ACCENT },
  brandSignalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: ACCENT },
  cancel: { fontFamily: fonts.medium, fontSize: 14, color: '#9A9AA0' },
  title:  { fontFamily: fonts.semiBold, fontSize: 15, color: '#FFFFFF', letterSpacing: -0.2 },
  done:   { fontFamily: fonts.semiBold, fontSize: 14, color: ACCENT },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brokenTxt: { fontFamily: fonts.medium, fontSize: 13.5, color: '#9A9AA0', paddingHorizontal: 32, textAlign: 'center' },

  strip: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  stripCell: {
    width: 46, height: 46, borderRadius: 6, overflow: 'hidden',
    backgroundColor: '#1A1C1E', borderWidth: 2, borderColor: 'transparent',
  },
  stripCellOn: { borderColor: ACCENT },
  stripDot: {
    position: 'absolute', right: 3, bottom: 3,
    width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT,
  },

  panel: { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#26282B' },

  chips: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    height: 34, paddingHorizontal: 14, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    backgroundColor: '#191B1D', borderWidth: 1, borderColor: 'transparent',
  },
  chipOn:  { borderColor: ACCENT, backgroundColor: 'rgba(255,122,28,0.14)' },
  chipTxt: { fontFamily: fonts.medium, fontSize: 13, color: '#9A9AA0' },
  chipTxtOn: { color: '#FFFFFF', fontFamily: fonts.semiBold },
  chipDot: { width: 4, height: 4, borderRadius: 2, marginLeft: 6, backgroundColor: '#9A9AA0' },
  chipDotOn: { backgroundColor: ACCENT },

  tools: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8 },
  tool: {
    flex: 1, height: 52, borderRadius: 10, backgroundColor: '#191B1D',
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  toolOff: { opacity: 0.4 },
  toolTxt: { fontFamily: fonts.medium, fontSize: 10.5, color: '#C8C8CE' },

  sliderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14,
  },
  sliderLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: '#FFFFFF' },
  sliderValue: { fontFamily: fonts.semiBold, fontSize: 13, color: ACCENT, minWidth: 34, textAlign: 'right' },
  sliderWrap:  { paddingHorizontal: 18, paddingBottom: 2 },

  filters: { paddingHorizontal: 14, gap: 10, paddingBottom: 6 },
  filterCell: { alignItems: 'center', gap: 5 },
  filterThumb: {
    width: THUMB, height: THUMB, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#191B1D', borderWidth: 2, borderColor: 'transparent',
  },
  filterThumbOn: { borderColor: ACCENT },
  filterTxt: { fontFamily: fonts.medium, fontSize: 11, color: '#9A9AA0' },
  filterTxtOn: { color: '#FFFFFF', fontFamily: fonts.semiBold },

  tabs: {
    flexDirection: 'row', paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#26282B',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 46 },
  tabTxt: { fontFamily: fonts.medium, fontSize: 11, color: '#8A8A90' },
  tabTxtOn: { color: '#FFFFFF', fontFamily: fonts.semiBold },

  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,13,14,0.86)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  busyTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: '#FFFFFF' },
})
