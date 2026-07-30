<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Perfil'
})

useHead({
  title: 'Perfil | Velox'
})

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()

const {
  activeOrganization,
  organizationsLoading
} = useOrganization()

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome completo.'),
  display_name: z.string().trim().optional(),
  job_title: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  avatar_url: z.string().trim().url('Informe uma URL válida.').or(z.literal(''))
})

const passwordSchema = z.object({
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  password_confirmation: z.string().min(8, 'Confirme a nova senha.')
}).refine(
  data => data.password === data.password_confirmation,
  {
    path: ['password_confirmation'],
    message: 'As senhas não coincidem.'
  }
)

type ProfileSchema = z.output<typeof profileSchema>
type PasswordSchema = z.output<typeof passwordSchema>

const profileState = reactive<ProfileSchema>({
  full_name: '',
  display_name: '',
  job_title: '',
  phone: '',
  avatar_url: ''
})

const passwordState = reactive<PasswordSchema>({
  password: '',
  password_confirmation: ''
})

const savingProfile = ref(false)
const savingPassword = ref(false)
const passwordVisible = ref(false)

const avatarPreview = computed(() => {
  return profileState.avatar_url || undefined
})

const avatarAlt = computed(() => {
  return profileState.display_name
    || profileState.full_name
    || user.value?.email
    || 'Usuário'
})

function fillProfile() {
  const metadata = user.value?.user_metadata ?? {}

  Object.assign(profileState, {
    full_name: metadata.full_name ?? metadata.name ?? '',
    display_name: metadata.display_name ?? '',
    job_title: metadata.job_title ?? '',
    phone: metadata.phone ?? '',
    avatar_url: metadata.avatar_url ?? ''
  })
}

async function saveProfile(event: FormSubmitEvent<ProfileSchema>) {
  savingProfile.value = true

  try {
    const currentMetadata = user.value?.user_metadata ?? {}

    const { error } = await supabase.auth.updateUser({
      data: {
        ...currentMetadata,
        full_name: event.data.full_name.trim(),
        display_name: event.data.display_name?.trim() || null,
        job_title: event.data.job_title?.trim() || null,
        phone: event.data.phone?.trim() || null,
        avatar_url: event.data.avatar_url?.trim() || null
      }
    })

    if (error) throw error

    toast.add({
      title: 'Perfil atualizado',
      description: 'Suas informações foram salvas com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (error) {
    toast.add({
      title: 'Não foi possível atualizar o perfil',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    savingProfile.value = false
  }
}

async function changePassword(event: FormSubmitEvent<PasswordSchema>) {
  savingPassword.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: event.data.password
    })

    if (error) throw error

    passwordState.password = ''
    passwordState.password_confirmation = ''

    toast.add({
      title: 'Senha alterada',
      description: 'Sua nova senha já está ativa.',
      color: 'success',
      icon: 'i-lucide-shield-check'
    })
  } catch (error) {
    toast.add({
      title: 'Não foi possível alterar a senha',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    savingPassword.value = false
  }
}

function getErrorMessage(error: unknown) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

watch(user, fillProfile, { immediate: true })
</script>

<template>
  <UDashboardPanel id="profile-settings">
    <template #header>
      <UDashboardNavbar title="Perfil" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <SettingsNavigation />

        <div>
          <h1 class="text-2xl font-semibold text-highlighted">
            Meu perfil
          </h1>
          <p class="mt-1 text-sm text-muted">
            Atualize suas informações pessoais e opções de segurança.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center gap-4">
              <UAvatar :src="avatarPreview" :alt="avatarAlt" size="xl" />

              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-highlighted">
                  {{ avatarAlt }}
                </p>
                <p class="truncate text-sm text-muted">
                  {{ user?.email }}
                </p>
                <p class="mt-1 truncate text-xs text-muted">
                  {{ organizationsLoading
                    ? 'Carregando organização...'
                    : activeOrganization?.name || 'Nenhuma organização selecionada' }}
                </p>
              </div>
            </div>
          </template>

          <UForm :schema="profileSchema" :state="profileState" class="space-y-6" @submit="saveProfile">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField name="full_name" label="Nome completo" required>
                <UInput v-model="profileState.full_name" placeholder="Seu nome completo" icon="i-lucide-user-round"
                  class="w-full" />
              </UFormField>

              <UFormField name="display_name" label="Nome de exibição">
                <UInput v-model="profileState.display_name" placeholder="Como deseja ser chamado" class="w-full" />
              </UFormField>

              <UFormField name="job_title" label="Cargo">
                <UInput v-model="profileState.job_title" placeholder="Ex.: Operador logístico"
                  icon="i-lucide-briefcase-business" class="w-full" />
              </UFormField>

              <UFormField name="phone" label="Telefone">
                <UInput v-model="profileState.phone" placeholder="(00) 00000-0000" icon="i-lucide-phone"
                  class="w-full" />
              </UFormField>
            </div>

            <UFormField name="avatar_url" label="URL do avatar">
              <UInput v-model="profileState.avatar_url" type="url" placeholder="https://exemplo.com/avatar.jpg"
                icon="i-lucide-image" class="w-full" />
            </UFormField>

            <UFormField label="E-mail da conta">
              <UInput :model-value="user?.email ?? ''" icon="i-lucide-mail" class="w-full" disabled />
            </UFormField>

            <div class="flex justify-end border-t border-default pt-5">
              <UButton type="submit" label="Salvar perfil" icon="i-lucide-save" :loading="savingProfile" />
            </div>
          </UForm>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold text-highlighted">
                Alterar senha
              </h2>
              <p class="mt-1 text-sm text-muted">
                Use pelo menos 8 caracteres e evite senhas reutilizadas.
              </p>
            </div>
          </template>

          <UForm :schema="passwordSchema" :state="passwordState" class="space-y-5" @submit="changePassword">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField name="password" label="Nova senha" required>
                <UInput v-model="passwordState.password" :type="passwordVisible ? 'text' : 'password'"
                  placeholder="Nova senha" icon="i-lucide-lock-keyhole" class="w-full" />
              </UFormField>

              <UFormField name="password_confirmation" label="Confirmar senha" required>
                <UInput v-model="passwordState.password_confirmation" :type="passwordVisible ? 'text' : 'password'"
                  placeholder="Repita a nova senha" icon="i-lucide-lock-keyhole" class="w-full" />
              </UFormField>
            </div>

            <div
              class="flex flex-col gap-3 border-t border-default pt-5 sm:flex-row sm:items-center sm:justify-between">
              <UCheckbox v-model="passwordVisible" label="Exibir senha" />

              <UButton type="submit" label="Alterar senha" icon="i-lucide-shield-check" :loading="savingPassword" />
            </div>
          </UForm>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
