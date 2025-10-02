<template>
  <div class="main-menu">
    <button class="menu-button">
      🧟 سناریو زامبی
    </button>
    <button class="menu-button">
      🏕️ پناهگاه
    </button>
    <button class="menu-button">
      🎒 کوله پشتی
    </button>
    <button class="menu-button">
      🛒 فروشگاه
    </button>
    <button class="menu-button">
      🏆 احتمال بقا
    </button>
  </div>
</template>

<script setup>
// No script logic needed for now
</script>

<style scoped>
.main-menu {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  width: 100%;
  padding: 20px 0;
}

.menu-button {
  width: 100%;
  padding: 15px;
  font-size: 16px;
  font-weight: bold;
  color: var(--tg-theme-button-text-color);
  background-color: var(--tg-theme-button-color);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
}

.menu-button:hover {
  opacity: 0.9;
}
</style>
