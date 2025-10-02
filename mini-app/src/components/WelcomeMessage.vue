<script setup>
defineProps({
  user: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div class="welcome-container">
    <p v-if="user">
      سلام <strong>{{ user.first_name }}</strong>، به آخرالزمان خوش آمدی!
      <br><br>
      از طریق منوی زیر می‌توانی برای بقا تلاش کنی:
    </p>
    <p v-else>
      در حال بارگذاری اطلاعات...
    </p>
  </div>
</template>

<style scoped>
.welcome-container p {
  color: var(--tg-theme-text-color);
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 20px;
}

strong {
  font-weight: bold;
}
</style>