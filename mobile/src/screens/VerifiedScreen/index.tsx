import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import { useT } from '../../i18n'

type Nav = StackNavigationProp<AppStackParams>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const G  = '#22C55E'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

export default function VerifiedScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.verified_title}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}
      >
        <View style={s.hero}>
          <View style={s.shieldCircle}>
            <Ionicons name="shield-checkmark-outline" size={42} color={B} />
          </View>
          <Text style={s.heroTitle}>{t.verified_heading}</Text>
          <Text style={s.heroSub}>{t.verified_sub}</Text>
        </View>

        <View style={s.benefits}>
          {([t.verified_b1, t.verified_b2, t.verified_b3] as string[]).map((b) => (
            <View key={b} style={s.benefitRow}>
              <View style={s.checkCircle}>
                <Ionicons name="checkmark" size={13} color={BG} />
              </View>
              <Text style={s.benefitTxt}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={s.stepsCard}>
          <View style={[s.stepRow, s.stepSep]}>
            <View style={[s.stepNum, { backgroundColor: G }]}>
              <Ionicons name="checkmark" size={14} color={BG} />
            </View>
            <Text style={s.stepTxt}>{t.verified_s1}</Text>
          </View>
          <View style={[s.stepRow, s.stepSep]}>
            <View style={[s.stepNum, { backgroundColor: B }]}>
              <Text style={s.stepNumTxt}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTxt}>{t.verified_s2}</Text>
              <Text style={s.stepSubTxt}>{t.verified_s2sub}</Text>
            </View>
          </View>
          <View style={s.stepRow}>
            <View style={[s.stepNum, { backgroundColor: BD }]}>
              <Text style={[s.stepNumTxt, { color: M }]}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.stepTxt, { color: M }]}>{t.verified_s3}</Text>
              <Text style={s.stepSubTxt}>{t.verified_s3sub}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.uploadCard} activeOpacity={0.75}>
          <View style={s.uploadIcon}>
            <Ionicons name="scan-outline" size={22} color={B} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadTitle}>{t.verified_upload}</Text>
            <Text style={s.uploadSub}>{t.verified_uploadSub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={B} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <View style={s.ctaWrap}>
          <View style={s.ctaDisabled}>
            <Text style={s.ctaDisabledTxt}>{t.verified_cta}</Text>
          </View>
          <Text style={s.ctaHint}>{t.verified_ctaHint}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 24, letterSpacing: -0.5, color: T },
  content: { paddingHorizontal: 16, gap: 14 },

  hero:       { alignItems: 'center', gap: 14 },
  shieldCircle: { width: 84, height: 84, borderRadius: 999, backgroundColor: 'rgba(76,140,228,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroTitle:  { fontFamily: fonts.extraBold, fontSize: 24, letterSpacing: -0.6, color: T, textAlign: 'center' },
  heroSub:    { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: S, textAlign: 'center', paddingHorizontal: 8 },

  benefits:   { gap: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkCircle:{ width: 24, height: 24, borderRadius: 12, backgroundColor: G, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  benefitTxt: { fontFamily: fonts.medium, fontSize: 14, color: T, flex: 1 },

  stepsCard:  { backgroundColor: SX, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, padding: 14 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11 },
  stepSep:    { borderBottomWidth: 1, borderBottomColor: SEP },
  stepNum:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumTxt: { fontFamily: fonts.bold, fontSize: 14, color: BG },
  stepTxt:    { fontFamily: fonts.semiBold, fontSize: 14, color: T, flex: 1 },
  stepSubTxt: { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 2 },

  uploadCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: B, borderStyle: 'dashed',
    backgroundColor: 'rgba(76,140,228,0.05)',
  },
  uploadIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(76,140,228,0.14)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  uploadTitle: { fontFamily: fonts.bold, fontSize: 15, color: T },
  uploadSub:   { fontFamily: fonts.medium, fontSize: 12, color: S, marginTop: 2 },

  ctaWrap:       { gap: 10, marginTop: 6 },
  ctaDisabled:   { height: 52, borderRadius: 16, backgroundColor: BD, alignItems: 'center', justifyContent: 'center' },
  ctaDisabledTxt:{ fontFamily: fonts.bold, fontSize: 17, color: M, letterSpacing: -0.2 },
  ctaHint:       { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: M },
})
