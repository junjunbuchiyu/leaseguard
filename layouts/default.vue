<template>
  <div class="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
    <AppSidebar class="hidden lg:flex" />

    <div class="min-w-0 flex-1">
      <!-- 移动端顶部导航 -->
      <header class="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
        <NuxtLink to="/" class="text-sm font-bold tracking-tight text-slate-900">租约体检</NuxtLink>
        <NuxtLink to="/laws" class="text-xs text-slate-500">法规库</NuxtLink>
        <NuxtLink to="/about" class="text-xs text-slate-500">关于</NuxtLink>
        <NuxtLink to="/start" class="ml-auto rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white">
          新建审查
        </NuxtLink>
      </header>

      <slot />
    </div>
  </div>
</template>
