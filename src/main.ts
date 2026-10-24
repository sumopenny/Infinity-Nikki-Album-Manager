import { createApp } from 'vue'
import App from './App.vue'
import { installErrorReporting } from './utils/errorReporting/install'
import './styles/tokens.css'
import './styles/base.css'
import './styles/dialogs.css'
import './styles/top-bar.css'
import './styles/album.css'
import './styles/album-navigation.css'
import './styles/lightbox.css'
import './styles/outfit.css'
import './styles/controls.css'
import './styles/mobile.css'

import './styles/scrollbars.css'

const app = createApp(App)
const disposeErrorReporting = installErrorReporting(app)
app.mount('#app')
if (import.meta.hot) import.meta.hot.dispose(disposeErrorReporting)
