<script setup>
import { ref, onMounted } from 'vue';
import WelcomeMessage from './components/WelcomeMessage.vue';
import MainMenu from './components/MainMenu.vue';

const user = ref(null);
const webApp = window.Telegram.WebApp;

onMounted(() => {
  webApp.ready();
  if (webApp.initDataUnsafe?.user) {
    user.value = webApp.initDataUnsafe.user;
  }
});
</script>

<template>
  <div id="app">
    <WelcomeMessage :user="user" />
    <MainMenu />
  </div>
</template>

<style scoped>
#app {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: var(--tg-theme-text-color);
  background-color: var(--tg-theme-bg-color);
}
</style>
