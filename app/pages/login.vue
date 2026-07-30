<script setup lang="ts">
import type {
  AuthFormField,
  FormSubmitEvent,
} from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Entrar',
})

useSeoMeta({
  title: 'Entrar',
  description: 'Acesse sua conta Velox.',
})

const supabase = useSupabaseClient()
const toast = useToast()
const route = useRoute()

const loading = ref(false)
const authError = ref<string | null>(null)

const registrationCompleted = computed(() => {
  return route.query.registered === 'true'
})

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'nome@empresa.com.br',
    icon: 'i-lucide-mail',
    autocomplete: 'email',
    autofocus: true,
    required: true,
  },
  {
    name: 'password',
    type: 'password',
    label: 'Senha',
    placeholder: 'Digite sua senha',
    icon: 'i-lucide-lock',
    autocomplete: 'current-password',
    required: true,
  },
]

const schema = z.object({
  email: z
    .string({
      error: 'Informe seu email',
    })
    .trim()
    .min(1, 'Informe seu email')
    .email('Digite um email válido'),

  password: z
    .string({
      error: 'Informe sua senha',
    })
    .min(1, 'Informe sua senha')
    .min(6, 'A senha deve possuir pelo menos 6 caracteres'),
})

type LoginSchema = z.output<typeof schema>

function getRedirectPath(): string {
  const redirect = route.query.redirect

  if (
    typeof redirect === 'string'
    && redirect.startsWith('/')
    && !redirect.startsWith('//')
  ) {
    return redirect
  }

  return '/dashboard'
}

async function onSubmit(event: FormSubmitEvent<LoginSchema>) {
  if (loading.value) {
    return
  }

  loading.value = true
  authError.value = null

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: event.data.email.trim().toLowerCase(),
      password: event.data.password,
    })

    if (error) {
      authError.value = 'Email ou senha inválidos.'

      toast.add({
        title: 'Não foi possível entrar',
        description: 'Verifique seu email e sua senha.',
        icon: 'i-lucide-circle-alert',
        color: 'error',
      })

      return
    }

    toast.add({
      title: 'Login realizado',
      description: 'Bem-vindo ao Velox.',
      icon: 'i-lucide-circle-check',
      color: 'success',
    })

    await navigateTo(getRedirectPath())
  } catch (error) {
    console.error('Erro inesperado no login:', error)

    authError.value =
      'Não foi possível acessar o sistema neste momento.'

    toast.add({
      title: 'Erro inesperado',
      description: 'Tente novamente em alguns instantes.',
      icon: 'i-lucide-triangle-alert',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPageCard class="shadow-xl shadow-black/5 ring-1 ring-default">
    <UAuthForm :fields="fields" :schema="schema" :loading="loading" title="Bem-vindo de volta"
      description="Entre com suas credenciais para acessar sua operação." icon="i-lucide-lock-keyhole" :submit="{
        label: 'Entrar',
        icon: 'i-lucide-log-in',
        size: 'lg',
        color: 'primary',
        variant: 'solid',
      }" :ui="{
        leadingIcon: 'size-10 text-primary',
        form: 'space-y-5',
      }" @submit="onSubmit">
      <template #password-hint>
        <UButton to="/forgot-password" type="button" color="primary" variant="link" size="sm" class="p-0 font-medium">
          Esqueci minha senha
        </UButton>
      </template>

      <template #validation>
        <div class="space-y-3">
          <UAlert v-if="registrationCompleted" color="success" variant="subtle" icon="i-lucide-mail-check"
            title="Cadastro realizado" description="Verifique seu email para confirmar sua conta antes de entrar." />

          <UAlert v-if="authError" color="error" variant="subtle" icon="i-lucide-circle-alert"
            title="Falha na autenticação" :description="authError" />
        </div>
      </template>
    </UAuthForm>

    <!-- Fora do UAuthForm para nunca submeter o formulário -->
    <div class="mt-6 border-t border-default pt-5 text-center text-sm text-muted">
      Ainda não possui uma conta?

      <NuxtLink to="/register" class="ml-1 font-semibold text-primary hover:underline">
        Criar conta
      </NuxtLink>
    </div>
  </UPageCard>
</template>