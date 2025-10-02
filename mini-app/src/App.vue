<script setup>
import { ref, onMounted } from 'vue';

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
  <div class="container">
    <header>
      <h1>Z-Bot Mini App</h1>
    </header>
    <main>
      <div v-if="user">
        <h2>خوش آمدی، {{ user.first_name }}!</h2>
        <p>اینجا صفحه اصلی مینی اپ شماست.</p>
      </div>
      <div v-else>
        <p>در حال بارگذاری اطلاعات...</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.container {
  padding: 20px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
  color: var(--tg-theme-text-color);
  background-color: var(--tg-theme-bg-color);
}

h1,
h2 {
  color: var(--tg-theme-text-color);
}

p {
  color: var(--tg-theme-hint-color);
}
</style>
