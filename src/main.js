import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installSeo } from './seo'
import './style.css'
installSeo(router)
createApp(App).use(router).mount('#app')
