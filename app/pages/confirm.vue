<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  title: 'Confirmando conta',
})

useSeoMeta({
  title: 'Confirmando conta',
  description: 'Estamos confirmando sua conta Velox.',
  robots: 'noindex, nofollow',
})

type ConfirmationStatus = 'loading' | 'success' | 'error'

const user = useSupabaseUser()
const route = useRoute()

const status = ref<ConfirmationStatus>('loading')
const errorMessage = ref<string | null>(null)

let confirmationTimeout: ReturnType<typeof setTimeout> | undefined
let redirectTimeout: ReturnType<typeof setTimeout> | undefined

const statusContent = computed(() => {
  const contents = {
    loading: {
      title: 'Confirmando seu email',
      description:
        'Aguarde enquanto validamos sua conta e preparamos seu acesso.',
      icon: 'i-lucide-loader-circle',
      iconClass: 'animate-spin text-primary',
      containerClass: 'bg-primary/10 ring-primary/20',
      color: 'primary',
    },
    success: {
      title: 'Email confirmado',
      description:
        'Sua conta foi confirmada com sucesso. Você será redirecionado em instantes.',
      icon: 'i-lucide-circle-check',
      iconClass: 'text-success',
      containerClass: 'bg-success/10 ring-success/20',
      color: 'success',
    },
    error: {
      title: 'Não foi possível confirmar',
      description:
        errorMessage.value
        ?? 'O link de confirmação é inválido, expirou ou já foi utilizado.',
      icon: 'i-lucide-circle-alert',
      iconClass: 'text-error',
      containerClass: 'bg-error/10 ring-error/20',
      color: 'error',
    },
  } as const

  return contents[status.value]
})

function getQueryValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }

  return null
}

function getCallbackError(): string | null {
  const description = getQueryValue(route.query.error_description)
  const errorCode = getQueryValue(route.query.error_code)
  const error = getQueryValue(route.query.error)

  if (description) {
    return decodeURIComponent(description.replace(/\+/g, ' '))
  }

  if (errorCode === 'otp_expired') {
    return 'Este link de confirmação expirou. Solicite um novo cadastro ou email de confirmação.'
  }

  if (error === 'access_denied') {
    return 'O acesso foi recusado ou o link de confirmação não é mais válido.'
  }

  return null
}

function redirectToDashboard() {
  redirectTimeout = setTimeout(async () => {
    await navigateTo('/dashboard', {
      replace: true,
    })
  }, 1500)
}

watch(
  user,
  (authenticatedUser) => {
    if (!authenticatedUser) {
      return
    }

    if (confirmationTimeout) {
      clearTimeout(confirmationTimeout)
    }

    status.value = 'success'
    errorMessage.value = null

    redirectToDashboard()
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  const callbackError = getCallbackError()

  if (callbackError) {
    status.value = 'error'
    errorMessage.value = callbackError
    return
  }

  /*
   * Evita deixar o usuário aguardando indefinidamente caso
   * o callback esteja inválido ou não gere uma sessão.
   */
  confirmationTimeout = setTimeout(() => {
    if (!user.value && status.value === 'loading') {
      status.value = 'error'
      errorMessage.value =
        'A confirmação demorou mais do que o esperado. O link pode ter expirado ou já ter sido utilizado.'
    }
  }, 15_000)
})

onBeforeUnmount(() => {
  if (confirmationTimeout) {
    clearTimeout(confirmationTimeout)
  }

  if (redirectTimeout) {
    clearTimeout(redirectTimeout)
  }
})
</script>

<template>
  <UPageCard
    highlight
    :highlight-color="statusContent.color"
    variant="subtle"
    class="shadow-xl shadow-black/5"
    :ui="{
      container: 'text-center',
      wrapper: 'items-center',
      leading: 'mb-5',
      title: 'text-xl sm:text-2xl',
      description: 'mt-2 max-w-sm text-center',
      body: 'w-full',
    }"
  >
    <template #leading>
      <div
        class="flex size-16 items-center justify-center rounded-full ring-1"
        :class="statusContent.containerClass"
      >
        <UIcon
          :name="statusContent.icon"
          class="size-8"
          :class="statusContent.iconClass"
        />
      </div>
    </template>

    <template #title>
      {{ statusContent.title }}
    </template>

    <template #description>
      {{ statusContent.description }}
    </template>

    <div class="mt-6 w-full">
      <!-- Processando -->
      <div
        v-if="status === 'loading'"
        class="space-y-4"
      >
        <UProgress
          animation="swing"
          size="sm"
        />

        <p class="text-xs text-muted">
          Não feche esta página durante a confirmação.
        </p>
      </div>

      <!-- Sucesso -->
      <div
        v-else-if="status === 'success'"
        class="space-y-4"
      >
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-layout-dashboard"
          title="Acesso liberado"
          description="Redirecionando você para o painel..."
        />

        <UButton
          to="/dashboard"
          type="button"
          block
          size="lg"
          color="primary"
          icon="i-lucide-arrow-right"
          trailing
        >
          Ir para o painel
        </UButton>
      </div>

      <!-- Erro -->
      <div
        v-else
        class="space-y-4"
      >
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-link-2-off"
          title="Falha na confirmação"
          :description="errorMessage ?? undefined"
        />

        <div class="grid gap-3 sm:grid-cols-2">
          <UButton
            to="/login"
            type="button"
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-lucide-log-in"
            block
          >
            Ir para o login
          </UButton>

          <UButton
            to="/register"
            type="button"
            size="lg"
            color="primary"
            icon="i-lucide-user-plus"
            block
          >
            Criar nova conta
          </UButton>
        </div>
      </div>
    </div>

    <template #footer>
      <p class="text-center text-xs text-muted">
        A confirmação protege sua conta e garante que o email informado
        pertence a você.
      </p>
    </template>
  </UPageCard>
</template>