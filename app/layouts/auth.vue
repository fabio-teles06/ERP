<script setup lang="ts">
const currentYear = new Date().getFullYear()

const features = [
  {
    title: 'Rotas otimizadas',
    icon: 'i-lucide-map',
  },
  {
    title: 'Gestão de frota',
    icon: 'i-lucide-truck',
  },
  {
    title: 'Mais eficiência',
    icon: 'i-lucide-chart-no-axes-combined',
  },
] as const
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden bg-default">
    <!-- Decoração de fundo -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0"
    >
      <div
        class="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl"
      />

      <div
        class="absolute -bottom-24 -left-24 size-80 rounded-full bg-primary/10 blur-3xl"
      />
    </div>

    <div class="relative grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <!-- Painel institucional -->
      <section
        class="relative hidden overflow-hidden bg-primary p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"
      >
        <!-- Padrão decorativo -->
        <div
          aria-hidden="true"
          class="absolute inset-0 opacity-15
          bg-[radial-gradient(circle_at_center,white_3px,transparent_1px)]
          bg-size-[28px_28px]"
        />

        <!-- Logo -->
        <UButton
          to="/"
          color="neutral"
          variant="ghost"
          aria-label="Ir para a página inicial"
          class="relative w-fit p-0 text-white hover:bg-transparent"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur"
            >
              <UIcon
                name="i-lucide-route"
                class="size-6"
              />
            </div>

            <span class="text-2xl font-bold tracking-tight">
              Velox
            </span>
          </div>
        </UButton>

        <!-- Apresentação -->
        <div class="relative max-w-xl">
          <UBadge
            label="Plataforma de roteirização"
            color="neutral"
            variant="subtle"
            class="mb-6 bg-white/10 text-white ring-white/20"
          />

          <h1 class="text-4xl font-bold leading-tight xl:text-5xl">
            Suas entregas organizadas em rotas mais eficientes.
          </h1>

          <p class="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
            Planeje rotas, acompanhe entregas e gerencie sua operação
            logística em um único lugar.
          </p>

          <UPageGrid class="mt-10 max-w-lg grid-cols-3! gap-4">
            <UPageCard
              v-for="feature in features"
              :key="feature.title"
              :title="feature.title"
              :icon="feature.icon"
              variant="ghost"
              class="bg-white/10 ring-1 ring-white/15"
              :ui="{
                container: 'p-4 sm:p-4',
                leading: 'mb-3',
                leadingIcon: 'size-5 text-white',
                title: 'text-sm font-medium text-white',
              }"
            />
          </UPageGrid>
        </div>

        <p class="relative text-sm text-white/60">
          Tecnologia para operações logísticas mais eficientes.
        </p>
      </section>

      <!-- Área de autenticação -->
      <div class="relative flex min-h-dvh flex-col">
        <UHeader
          title="Velox"
          :toggle="false"
          :ui="{
            root: 'relative z-auto border-b-0 bg-transparent backdrop-blur-none',
            container: 'max-w-none px-5 sm:px-8',
            left: 'lg:hidden',
            right: 'ml-auto lg:flex-none',
          }"
        >
          <template #left>
            <UButton
              to="/"
              color="neutral"
              variant="ghost"
              aria-label="Ir para a página inicial"
              class="-ml-2"
            >
              <div class="flex items-center gap-2">
                <div
                  class="flex size-9 items-center justify-center rounded-lg bg-primary text-white"
                >
                  <UIcon
                    name="i-lucide-route"
                    class="size-5"
                  />
                </div>

                <span class="text-lg font-bold text-highlighted">
                  Velox
                </span>
              </div>
            </UButton>
          </template>

          <template #right>
            <UTooltip text="Alternar tema">
              <UColorModeButton
                color="neutral"
                variant="ghost"
              />
            </UTooltip>
          </template>
        </UHeader>

        <UMain
          class="flex flex-1 items-center justify-center min-h-0! px-4 py-10 sm:px-8"
        >
          <UContainer class="w-full max-w-md px-0">
            <slot />
          </UContainer>
        </UMain>

        <USeparator />

        <UFooter
          :ui="{
            root: 'border-0 bg-transparent',
            container: 'justify-center py-6',
            left: 'm-0 flex-none justify-center lg:m-0 lg:flex-none lg:justify-center',
            center: 'hidden',
            right: 'hidden',
          }"
        >
          <template #left>
            <p class="text-center text-sm text-muted">
              &copy; {{ currentYear }} Velox. Todos os direitos reservados.
            </p>
          </template>
        </UFooter>
      </div>
    </div>
  </div>
</template>