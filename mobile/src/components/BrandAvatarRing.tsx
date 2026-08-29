import React, { memo, useId } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

import { gradients } from '../theme'

interface Props {
  size: number
  strokeWidth?: number
  visible?: boolean
  style?: StyleProp<ViewStyle>
}

const RING_COLORS = [...gradients.avatarRing]
// Stops medidos na referência: o violeta ocupa o centro e faz a transição entre
// o azul mais denso à esquerda e o magenta mais luminoso à direita.
const RING_POSITIONS = [0, 0.24, 0.5, 0.76, 1] as const

/**
 * O anel cromático oficial da plataforma.
 *
 * A referência não é um arco-íris circular: é um gradiente linear horizontal
 * azul → violeta → magenta aplicado a uma circunferência. O SVG pinta esse
 * gradiente directamente no traço, deixando o centro realmente transparente;
 * não há disco mascarado, emenda angular ou dependência da cor do fundo.
 */
function BrandAvatarRing({
  size,
  strokeWidth = 2,
  visible = true,
  style,
}: Props) {
  const reactId = useId()
  if (!visible || size <= 0 || strokeWidth <= 0) return null

  const center = size / 2
  const radius = Math.max(0, (size - strokeWidth) / 2)
  const gradientId = `luxee-avatar-ring-${reactId.replace(/:/g, '')}`

  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={[{ width: size, height: size }, style]}
    >
      <Defs>
        <LinearGradient
          id={gradientId}
          x1={0}
          y1={center}
          x2={size}
          y2={center}
          gradientUnits="userSpaceOnUse"
        >
          {RING_COLORS.map((color, index) => (
            <Stop
              key={`${color}:${RING_POSITIONS[index]}`}
              offset={RING_POSITIONS[index]}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}

export default memo(BrandAvatarRing)
