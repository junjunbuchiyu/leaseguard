<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <nav class="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <NuxtLink to="/" class="font-semibold">Nuxt 3 Starter</NuxtLink>
        <NuxtLink to="/about" class="text-sm text-gray-600 hover:text-gray-900">About</NuxtLink>
      </nav>
    </header>
    <main class="mx-auto max-w-3xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>