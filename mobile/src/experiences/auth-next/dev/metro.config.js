const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

/**
 * O anfitrião corre a partir desta pasta, mas o código que lhe interessa vive
 * na aplicação: o módulo em `src/experiences/auth-next`, os ícones, os serviços
 * e os assets da marca. `watchFolders` aponta para a raiz do projeto Expo para
 * o Metro poder segui-los; `nodeModulesPaths` aponta para as dependências que já
 * estão instaladas lá, para não haver uma segunda instalação.
 *
 * Este ficheiro é novo e vive dentro da pasta nova. O projeto original continua
 * sem `metro.config.js`, exactamente como estava.
 */
const projectRoot = __dirname
const appRoot = path.resolve(__dirname, '../../../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [appRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(appRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

module.exports = config
