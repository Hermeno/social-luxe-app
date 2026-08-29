import React from 'react'
import Icon from './Icon'
import { colors } from '../theme'

/** O selo acompanha texto de 15pt: 14pt preserva a leitura sem dominar o nome. */
export const VERIFIED_BADGE_SIZE = 14

interface Props {
  /** Lado do selo. */
  size?: number
  /** Sobrepõe a tinta para manter contraste com a superfície. */
  color?: string
}

/**
 * O selo de verificação, ao lado do nome.
 *
 * Existe como componente e não como `<Icon name="verified" />` solto em cada
 * ecrã porque é uma marca de identidade: aparece na feed, na pesquisa, no perfil
 * e nos comentários, e nesses quatro sítios tem de ser exactamente o mesmo
 * desenho e a mesma medida base. Contextos muito pequenos podem reduzi-lo.
 *
 * A tinta acompanha a superfície: escura por defeito nas folhas claras e branca
 * quando o chamador o coloca sobre a mídia. Assim o selo continua a ser identidade
 * sem introduzir uma terceira cor na linha do autor.
 */
export default function VerifiedBadge({ size = VERIFIED_BADGE_SIZE, color = colors.primary }: Props) {
  return <Icon name="verified" size={size} color={color} />
}
