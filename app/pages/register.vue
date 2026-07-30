<script setup lang="ts">
import type {
  AuthFormField,
  FormSubmitEvent,
} from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Criar conta',
})

useSeoMeta({
  title: 'Criar conta',
  description: 'Crie sua conta na plataforma Velox.',
})

const supabase = useSupabaseClient()
const toast = useToast()

const loading = ref(false)
const registerError = ref<string | null>(null)

const fields: AuthFormField[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nome completo',
    placeholder: 'Digite seu nome completo',
    icon: 'i-lucide-user',
    autocomplete: 'name',
    autofocus: true,
    required: true,
  },
  {
    name: 'organizationName',
    type: 'text',
    label: 'Nome da empresa',
    placeholder: 'Digite o nome da sua empresa',
    icon: 'i-lucide-building-2',
    autocomplete: 'organization',
    required: true,
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'nome@empresa.com.br',
    icon: 'i-lucide-mail',
    autocomplete: 'email',
    required: true,
  },
  {
    name: 'password',
    type: 'password',
    label: 'Senha',
    placeholder: 'Crie uma senha',
    icon: 'i-lucide-lock',
    autocomplete: 'new-password',
    required: true,
  },
  {
    name: 'confirmPassword',
    type: 'password',
    label: 'Confirmar senha',
    placeholder: 'Digite a senha novamente',
    icon: 'i-lucide-lock-keyhole',
    autocomplete: 'new-password',
    required: true,
  },
  {
    name: 'terms',
    type: 'checkbox',
    label: 'Aceito os termos de uso e a política de privacidade',
    required: true,
  },
]

const schema = z
  .object({
    name: z
      .string({
        error: 'Informe seu nome completo',
      })
      .trim()
      .min(1, 'Informe seu nome completo')
      .min(3, 'O nome deve possuir pelo menos 3 caracteres')
      .max(150, 'O nome deve possuir no máximo 150 caracteres'),

    organizationName: z
      .string({
        error: 'Informe o nome da empresa',
      })
      .trim()
      .min(1, 'Informe o nome da empresa')
      .min(2, 'O nome da empresa deve possuir pelo menos 2 caracteres')
      .max(
        150,
        'O nome da empresa deve possuir no máximo 150 caracteres',
      ),

    email: z
      .string({
        error: 'Informe seu email',
      })
      .trim()
      .min(1, 'Informe seu email')
      .email('Digite um email válido'),

    password: z
      .string({
        error: 'Informe uma senha',
      })
      .min(1, 'Informe uma senha')
      .min(8, 'A senha deve possuir pelo menos 8 caracteres')
      .regex(
        /[A-Z]/,
        'A senha deve possuir pelo menos uma letra maiúscula',
      )
      .regex(
        /[a-z]/,
        'A senha deve possuir pelo menos uma letra minúscula',
      )
      .regex(
        /\d/,
        'A senha deve possuir pelo menos um número',
      ),

    confirmPassword: z
      .string({
        error: 'Confirme sua senha',
      })
      .min(1, 'Confirme sua senha'),

    terms: z
      .boolean({
        error: 'Você precisa aceitar os termos para continuar',
      })
      .refine(
        value => value === true,
        'Você precisa aceitar os termos para continuar',
      ),
  })
  .refine(
    data => data.password === data.confirmPassword,
    {
      message: 'As senhas não são iguais',
      path: ['confirmPassword'],
    },
  )

type RegisterSchema = z.output<typeof schema>

function getErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('already registered')
    || normalizedMessage.includes('already exists')
    || normalizedMessage.includes('user already registered')
  ) {
    return 'Já existe uma conta cadastrada com este email.'
  }

  if (
    normalizedMessage.includes('password')
    && normalizedMessage.includes('weak')
  ) {
    return 'A senha informada não atende aos requisitos de segurança.'
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'Muitas tentativas foram realizadas. Aguarde alguns minutos.'
  }

  if (
    normalizedMessage.includes('signup')
    && normalizedMessage.includes('disabled')
  ) {
    return 'O cadastro de novos usuários está desabilitado.'
  }

  return 'Não foi possível criar sua conta. Verifique os dados e tente novamente.'
}

async function onSubmit(event: FormSubmitEvent<RegisterSchema>) {
  if (loading.value) {
    return
  }

  loading.value = true
  registerError.value = null

  try {
    const email = event.data.email
      .trim()
      .toLowerCase()

    const password = event.data.password
    const fullName = event.data.name.trim()
    const organizationName = event.data.organizationName.trim()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName,
        },
      },
    })

    if (error) {
      registerError.value = getErrorMessage(error.message)

      toast.add({
        title: 'Não foi possível criar a conta',
        description: registerError.value,
        icon: 'i-lucide-circle-alert',
        color: 'error',
      })

      return
    }

    if (data.session) {
      toast.add({
        title: 'Conta criada',
        description: `A organização ${organizationName} foi cadastrada.`,
        icon: 'i-lucide-circle-check',
        color: 'success',
      })

      await navigateTo('/dashboard')
      return
    }

    toast.add({
      title: 'Confirme seu email',
      description: 'Enviamos uma mensagem de confirmação para seu email.',
      icon: 'i-lucide-mail-check',
      color: 'success',
    })

    await navigateTo({
      path: '/login',
      query: {
        registered: 'true',
      },
    })
  } catch (error) {
    console.error('Erro inesperado no cadastro:', error)

    registerError.value =
      'Ocorreu um erro inesperado. Tente novamente em alguns instantes.'

    toast.add({
      title: 'Erro inesperado',
      description: registerError.value,
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
    <UAuthForm :fields="fields" :schema="schema" :loading="loading" title="Crie sua conta"
      description="Cadastre sua empresa e comece a gerenciar suas entregas." icon="i-lucide-user-round-plus" :submit="{
        label: 'Criar minha conta',
        icon: 'i-lucide-user-plus',
        size: 'lg',
        color: 'primary',
        variant: 'solid',
      }" :ui="{
        leadingIcon: 'size-10 text-primary',
        form: 'space-y-5',
      }" @submit="onSubmit">
      <template #validation>
        <UAlert v-if="registerError" color="error" variant="subtle" icon="i-lucide-circle-alert"
          title="Falha no cadastro" :description="registerError" />
      </template>
    </UAuthForm>

    <div class="mt-6 border-t border-default pt-5 text-center text-sm text-muted">
      Já possui uma conta?

      <NuxtLink to="/login" class="ml-1 font-semibold text-primary hover:underline">
        Entrar
      </NuxtLink>
    </div>
  </UPageCard>
</template>