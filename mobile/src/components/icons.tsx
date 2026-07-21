import React from 'react'
import Svg, { Path } from 'react-native-svg'

// Ícones da pasta `icins/` convertidos para componentes (react-native-svg).
// Mantêm os paths originais — nada de aproximações.

interface IconProps {
  size?: number
  color?: string
}

// icins/teenyicons--chat-outline.svg — balão com a cauda à direita
export function ChatIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15">
      <Path
        fill={color}
        d="m11.5 13.5l.157-.475l-.218-.072l-.197.119zm2-2l-.421-.27l-.129.202l.076.226zm1 2.99l-.157.476a.5.5 0 0 0 .631-.634zm-3.258-1.418c-.956.575-2.485.919-3.742.919v1c1.385 0 3.106-.37 4.258-1.063zM7.5 13.99c-3.59 0-6.5-2.908-6.5-6.496H0a7.5 7.5 0 0 0 7.5 7.496zM1 7.495A6.5 6.5 0 0 1 7.5 1V0A7.5 7.5 0 0 0 0 7.495zM7.5 1C11.09 1 14 3.908 14 7.495h1A7.5 7.5 0 0 0 7.5 0zM14 7.495c0 1.331-.296 2.758-.921 3.735l.842.54C14.686 10.575 15 8.937 15 7.495zm-2.657 6.48l3 .99l.314-.949l-3-.99zm3.631.357l-1-2.99l-.948.316l1 2.991z"
      />
    </Svg>
  )
}

// icins/material-symbols--hide.svg — setas a recolher (esconder objetos)
export function HideIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M4.425 21L3 19.575L7.6 15H5v-2h6v6H9v-2.6zM13 11V5h2v2.6L19.575 3L21 4.425L16.4 9H19v2z"
      />
    </Svg>
  )
}

// icins/gravity-ui--paper-plane.svg — avião de papel (partilhar)
export function PaperPlaneIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.29 13.904L5.25 10.75L2.096 8.71a2.4 2.4 0 0 1 .5-4.278l9.273-3.296a2.346 2.346 0 0 1 2.996 2.995L13.45 3.63a.844.844 0 0 0-1.08-1.08L3.1 5.846a.9.9 0 0 0-.19 1.604l2.78 1.799l3.279-3.28a.75.75 0 1 1 1.06 1.061L6.75 10.31l1.799 2.779a.9.9 0 0 0 1.604-.188l3.297-9.272l1.413.502l-3.296 9.273a2.4 2.4 0 0 1-4.277.5"
      />
    </Svg>
  )
}

// icins/basil--add-outline.svg — mais dentro de moldura arredondada
export function AddIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M7.007 12a.75.75 0 0 1 .75-.75h3.493V7.757a.75.75 0 0 1 1.5 0v3.493h3.493a.75.75 0 1 1 0 1.5H12.75v3.493a.75.75 0 0 1-1.5 0V12.75H7.757a.75.75 0 0 1-.75-.75"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.317 3.769a42.5 42.5 0 0 1 9.366 0c1.827.204 3.302 1.643 3.516 3.48c.37 3.157.37 6.346 0 9.503c-.215 1.837-1.69 3.275-3.516 3.48a42.5 42.5 0 0 1-9.366 0c-1.827-.205-3.302-1.643-3.516-3.48a41 41 0 0 1 0-9.503c.214-1.837 1.69-3.276 3.516-3.48m9.2 1.49a41 41 0 0 0-9.034 0A2.486 2.486 0 0 0 5.29 7.424a39.4 39.4 0 0 0 0 9.154a2.486 2.486 0 0 0 2.193 2.164c2.977.332 6.057.332 9.034 0a2.486 2.486 0 0 0 2.192-2.164a39.4 39.4 0 0 0 0-9.154a2.486 2.486 0 0 0-2.192-2.163"
      />
    </Svg>
  )
}
