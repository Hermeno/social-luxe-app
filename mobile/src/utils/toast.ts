import Toast from 'react-native-toast-message'

export const toast = {
  success: (text1: string, text2?: string) =>
    Toast.show({ type: 'success', text1, text2, visibilityTime: 2500, position: 'top' }),
  error: (text1: string, text2?: string) =>
    Toast.show({ type: 'error', text1, text2, visibilityTime: 3500, position: 'top' }),
  info: (text1: string, text2?: string) =>
    Toast.show({ type: 'info', text1, text2, visibilityTime: 2500, position: 'top' }),
}
