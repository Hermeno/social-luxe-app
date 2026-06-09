import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>

const APP_VERSION = '1.0.0'

const PRIVACY_SECTIONS = [
  {
    title: '1. Dados que Recolhemos',
    body: 'Recolhemos informações que forneces ao criar uma conta: nome, endereço de e-mail, foto de perfil, localização aproximada (cidade/distrito) e conteúdo que publicas. Também recolhemos automaticamente dados de utilização, endereço IP e informações do dispositivo para melhorar o serviço.',
  },
  {
    title: '2. Como Usamos os Teus Dados',
    body: 'Usamos os teus dados para fornecer e melhorar o serviço, personalizar a tua experiência, enviar notificações importantes sobre a conta e garantir a segurança da plataforma. Nunca vendemos os teus dados pessoais a terceiros.',
  },
  {
    title: '3. Partilha de Dados',
    body: 'Os teus dados não são partilhados com terceiros para fins comerciais. Podemos partilhar dados anonimizados e agregados para análises. Em caso de obrigação legal ou para proteger os direitos dos utilizadores, podemos divulgar informações às autoridades competentes.',
  },
  {
    title: '4. Retenção de Dados',
    body: 'Conservamos os teus dados enquanto a tua conta estiver activa. Podes solicitar a eliminação da tua conta e todos os dados associados a qualquer momento enviando um e-mail para luxee@gmail.com.',
  },
  {
    title: '5. Segurança',
    body: 'Implementamos medidas técnicas e organizacionais para proteger os teus dados contra acesso não autorizado, alteração, divulgação ou destruição. Todas as comunicações são encriptadas via HTTPS.',
  },
  {
    title: '6. Os Teus Direitos',
    body: 'Tens o direito de aceder, corrigir ou eliminar os teus dados pessoais. Podes exportar os teus dados ou revogar o consentimento a qualquer momento através das definições da conta ou contactando-nos directamente.',
  },
  {
    title: '7. Cookies e Tecnologias Similares',
    body: 'Utilizamos armazenamento local no dispositivo para guardar preferências e melhorar a experiência de utilização. Não utilizamos cookies de rastreamento de terceiros.',
  },
  {
    title: '8. Menores',
    body: 'O luxee não é destinado a menores de 18 anos. Se tomarmos conhecimento de que recolhemos dados de um menor, eliminaremos imediatamente essa informação.',
  },
  {
    title: '9. Alterações a esta Política',
    body: 'Podemos actualizar esta política periodicamente. Notificaremos os utilizadores sobre alterações significativas através da aplicação ou por e-mail. O uso continuado do serviço após as alterações constitui aceitação da nova política.',
  },
  {
    title: '10. Contacto',
    body: 'Para questões sobre privacidade, contacta-nos em luxee@gmail.com ou através do formulário de contacto disponível no nosso site.',
  },
]

function AccordionItem({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false)
  return (
    <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.7} style={s.accordionItem}>
      <View style={s.accordionHeader}>
        <Text style={s.accordionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.gray400} />
      </View>
      {open && <Text style={s.accordionBody}>{body}</Text>}
    </TouchableOpacity>
  )
}

function ContactRow({ icon, label, value, onPress }: {
  icon: string; label: string; value: string; onPress?: () => void
}) {
  return (
    <TouchableOpacity style={s.contactRow} onPress={onPress} activeOpacity={onPress ? 0.65 : 1}>
      <Ionicons name={icon as any} size={16} color={colors.gray400} />
      <View style={{ flex: 1 }}>
        <Text style={s.contactLabel}>{label}</Text>
        <Text style={s.contactValue}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color={colors.gray400} />}
    </TouchableOpacity>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

function Divider() {
  return <View style={s.divider} />
}

export default function AboutScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()

  function openLink(url: string) {
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o link.'))
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>sobre o luxee</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + 40 }}>

        {/* App identity */}
        <View style={s.identity}>
          <Text style={s.appName}>luxee</Text>
          <Text style={s.appTagline}>a tua rede social sem fronteiras</Text>
          <Text style={s.appMeta}>versão {APP_VERSION} · moçambique 🇲🇿</Text>
        </View>

        <Divider />

        {/* Criador */}
        <SectionTitle>CRIADOR</SectionTitle>
        <View style={s.creatorBlock}>
          <Text style={s.creatorName}>Herminio A. Macamo</Text>
          <Text style={s.creatorRole}>Desenvolvedor de Software</Text>
          <Text style={s.creatorLocation}>Chibuto, Gaza — Moçambique</Text>
        </View>

        <Divider />

        {/* Contacto */}
        <SectionTitle>CONTACTO</SectionTitle>
        <ContactRow
          icon="mail-outline"
          label="e-mail da app"
          value="luxee@gmail.com"
          onPress={() => openLink('mailto:luxee@gmail.com')}
        />
        <ContactRow
          icon="mail-outline"
          label="e-mail pessoal"
          value="herminiomacamo6@gmail.com"
          onPress={() => openLink('mailto:herminiomacamo6@gmail.com')}
        />
        <ContactRow
          icon="logo-whatsapp"
          label="whatsapp / chamada"
          value="+258 84 205 9826"
          onPress={() => openLink('https://wa.me/258842059826')}
        />
        <ContactRow
          icon="location-outline"
          label="país de origem"
          value="Chibuto, Gaza — Moçambique"
        />

        <Divider />

        {/* Política de Privacidade */}
        <SectionTitle>POLÍTICA DE PRIVACIDADE</SectionTitle>
        <Text style={s.introText}>
          A tua privacidade é uma prioridade para nós. Esta política descreve como recolhemos,
          usamos e protegemos os teus dados pessoais.{'\n'}
          Última actualização: Junho 2026
        </Text>
        {PRIVACY_SECTIONS.map((sec) => (
          <AccordionItem key={sec.title} title={sec.title} body={sec.body} />
        ))}

        <Divider />

        {/* Termos de Uso */}
        <SectionTitle>TERMOS DE USO</SectionTitle>
        <Text style={s.introText}>
          Ao usar o luxee concordas em não publicar conteúdo ofensivo, ilegal ou que viole
          direitos de terceiros. O luxee reserva-se o direito de remover conteúdo ou suspender
          contas que violem estas regras. O serviço é fornecido "como está" e podemos alterar
          ou descontinuar funcionalidades a qualquer momento com aviso prévio.{'\n\n'}
          Para questões legais: luxee@gmail.com
        </Text>

        <Divider />

        <Text style={s.footer}>© 2026 luxee · feito com ❤️ em moçambique</Text>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2,
  },

  identity: {
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24,
    alignItems: 'flex-start',
  },
  appName:    { fontSize: 32, fontFamily: fonts.extraBold, color: colors.gray800, letterSpacing: -1 },
  appTagline: { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, marginTop: 4 },
  appMeta:    { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 8 },

  divider: { height: 1, backgroundColor: colors.gray200, marginHorizontal: 20, marginVertical: 4 },

  sectionTitle: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.gray400,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },

  creatorBlock: { paddingHorizontal: 20, paddingBottom: 16, gap: 3 },
  creatorName:  { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800 },
  creatorRole:  { fontSize: 13, fontFamily: fonts.regular, color: colors.gray600 },
  creatorLocation: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  contactLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400, marginBottom: 1 },
  contactValue: { fontSize: 14, fontFamily: fonts.medium, color: colors.gray800 },

  introText: {
    fontSize: 13, fontFamily: fonts.regular, color: colors.gray600,
    lineHeight: 21, paddingHorizontal: 20, paddingBottom: 8,
  },

  accordionItem: {
    paddingHorizontal: 20, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: colors.gray200,
  },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle:  { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray800, flex: 1, paddingRight: 8 },
  accordionBody:   { fontSize: 13, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 21, marginTop: 8 },

  footer: {
    textAlign: 'center', fontSize: 12, fontFamily: fonts.regular,
    color: colors.gray400, paddingVertical: 24,
  },
})
