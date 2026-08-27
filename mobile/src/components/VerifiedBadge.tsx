import React from 'react'
import Icon from './Icon'
import { colors } from '../theme'
import { feedIcon } from '../screens/FeedScreen/tokens'

interface Props {
  /** Lado do selo. O degrau `inline` é o que acompanha texto numa linha. */
  size?: number
  /** Sobrepõe a cor. Só para superfícies onde o azul da marca não assenta. */
  color?: string
}

/**
 * O selo de verificação, ao lado do nome.
 *
 * Existe como componente e não como `<Icon name="verified" />` solto em cada
 * ecrã porque é uma marca de identidade: aparece na feed, na pesquisa, no perfil
 * e nos comentários, e nesses quatro sítios tem de ser exactamente o mesmo
 * desenho, do mesmo tamanho, da mesma cor. Espalhado, bastava alguém escrever
 * 14 em vez de 12 num deles para o selo passar a ser quatro selos.
 *
 * Azul da marca: um selo cinzento não se lê como selo, e um selo com a cor de
 * acento competia com o botão de seguir que está na mesma linha.
 */
export default function VerifiedBadge({ size = feedIcon.inline, color = colors.primary }: Props) {
  return <Icon name="verified" size={size} color={color} />
}
