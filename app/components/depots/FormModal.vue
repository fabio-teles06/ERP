<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Enums, Tables } from '~/types/database.types'

type Depot = Tables<'depots'>

const props = defineProps<{
  depot?: Depot | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const schema = z.object({
  name: z.string().trim().min(1, 'O nome do depósito é obrigatório.'),
  sigla: z.string().trim().min(1, 'A sigla do depósito é obrigatória.'),
  address_line: z.string().trim().optional(),
  address_number: z.string().trim().optional(),
  address_complement: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, 'Use a sigla do estado.').optional(),
  postal_code: z.string().trim().optional(),
  latitude: z.number(),
  longitude: z.number(),
}).superRefine((data, ctx) => {
  if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
    ctx.addIssue({
      code: 'custom',
      path: ['latitude'],
      message: 'A latitude deve estar entre -90 e 90.'
    })
  }

  if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) {
    ctx.addIssue({
      code: 'custom',
      path: ['longitude'],
      message: 'A longitude deve estar entre -180 e 180.'
    })
  }
})

type Schema = z.output<typeof schema>

interface FormState {
  name: string
  sigla: string
  address_line: string
  address_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
  postal_code: string
  latitude: number
  longitude: number
}

function createInitialState(): FormState {
  return {
    name: '',
    sigla: '',
    address_line: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: 0,
    longitude: 0,
  }
}

const state = reactive<FormState>(createInitialState())
const submitting = ref(false)

const isEditing = computed(() => Boolean(props.depot?.id))
const title = computed(() => isEditing.value ? 'Editar depósito' : 'Novo depósito')
const description = computed(() => isEditing.value
  ? 'Atualize os dados do depósito selecionado.'
  : 'Cadastre o nome e a sigla do depósito.'
)

function emptyToNull(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || null
}


function resetForm() {
  Object.assign(state, createInitialState())

  if (!props.depot) return

  Object.assign(state, {
    name: props.depot.name,
    sigla: props.depot.sigla,
    address_line: props.depot.address_line ?? '',
    address_number: props.depot.address_number ?? '',
    address_complement: props.depot.address_complement ?? '',
    neighborhood: props.depot.neighborhood ?? '',
    city: props.depot.city ?? '',
    state: props.depot.state ?? '',
    postal_code: props.depot.postal_code ?? '',
    latitude: props.depot.latitude,
    longitude: props.depot.longitude
  })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!activeOrganizationId.value) {
    toast.add({
      title: 'Organização não selecionada',
      description: 'Selecione uma organização antes de salvar a entrega.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
    return
  }

  try {
    const payload = {
      name: state.name.trim(),
      sigla: state.sigla.trim(),
      address_line: emptyToNull(state.address_line),
      address_number: emptyToNull(state.address_number),
      address_complement: emptyToNull(state.address_complement),
      neighborhood: emptyToNull(state.neighborhood),
      city: emptyToNull(state.city),
      state: emptyToNull(state.state),
      postal_code: emptyToNull(state.postal_code),
      latitude: state.latitude ?? null,
      longitude: state.longitude ?? null
    }

    if (props.depot?.id) {
      const { error } = await supabase
        .from('depots')
        .update(payload)
        .eq('id', props.depot.id)
        .eq('organization_id', activeOrganizationId.value)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('depots')
        .insert({
          organization_id: activeOrganizationId.value,
          ...payload
        })

      if (error) throw error
    }

    toast.add({
      title: isEditing.value ? 'Depósito atualizado' : 'Depósito criado',
      description: isEditing.value
        ? 'As alterações foram salvas com sucesso.'
        : 'A entrega foi cadastrada com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    open.value = false
    emit('saved')
  } catch (error) {
    toast.add({
      title: 'Não foi possível salvar o depósito',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    submitting.value = false
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

watch(
  [open, () => props.depot],
  ([isOpen]) => {
    if (isOpen) resetForm()
  },
  { immediate: true }
)
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" scrollable :ui="{ content: 'sm:max-w-5xl' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
        <section class="space-y-4">
          <div>
            <h3 class="font-medium text-highlighted">Identificação</h3>
            <p class="text-sm text-muted">Dados da nota fiscal e referência externa.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField name="name" label="Nome" required>
              <UInput v-model="state.name" placeholder="Depósito Central" class="w-full" />
            </UFormField>

            <UFormField name="sigla" label="Sigla" required>
              <UInput v-model="state.sigla" maxlength="3" placeholder="DC" class="w-full" />
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <AddressInput v-model:state="state" />
        </section>

        <div class="flex justify-end gap-2 border-t border-default pt-5">
          <UButton type="button" label="Cancelar" color="neutral" variant="outline" :disabled="submitting"
            @click="() => { open = false }" />

          <UButton type="submit" :label="isEditing ? 'Salvar alterações' : 'Criar depósito'" icon="i-lucide-save"
            :loading="submitting" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
