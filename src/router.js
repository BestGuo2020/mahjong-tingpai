import { createRouter, createWebHistory } from 'vue-router'

const RouteAnchor = { template: '<span />' }

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'standard', component: RouteAnchor },
    { path: '/baibian', name: 'baibian', component: RouteAnchor },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
