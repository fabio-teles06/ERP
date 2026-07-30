<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Tables } from '~/types/database.types'

type Client = Tables<'clients'>
type NumericInput = number | '' | undefined

const props = defineProps<{
  client?: Client | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const optionalCoordinate = z.preprocess(
  value => value === '' || value === null || value === undefined
    ? undefined
    : Number(value),
  z.number().finite('Informe um número válido.').optional()
)

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.'),
  trade_name: z.string().trim().optional(),
  document: z.string().trim().optional(),
  email: z.string().trim().email('Informe um e-mail válido.').or(z.literal('')).optional(),
  phone: z.string().trim().optional(),
  address_line: z.string().trim().optional(),
  address_number: z.string().trim().optional(),
  address_complement: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, 'Use a sigla do estado.').optional(),
  postal_code: z.string().trim().optional(),
  latitude: optionalCoordinate,
  longitude: optionalCoordinate
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
  trade_name: string
  document: string
  email: string
  phone: string
  address_line: string
  address_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
  postal_code: string
  latitude: NumericInput
  longitude: NumericInput
}

function createInitialState(): FormState {
  return {
    name: '',
    trade_name: '',
    document: '',
    email: '',
    phone: '',
    address_line: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: undefined,
    longitude: undefined
  }
}

const state = reactive<FormState>(createInitialState())
const submitting = ref(false)

const isEditing = computed(() => Boolean(props.client?.id))
const title = computed(() => isEditing.value ? 'Editar cliente' : 'Novo cliente')
const description = computed(() => isEditing.value
  ? 'Atualize os dados do cliente selecionado.'
  : 'Cadastre um remetente ou destinatário para as entregas.'
)

function emptyToNull(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function resetForm() {
  Object.assign(state, createInitialState())

  if (!props.client) {
    return
  }

  Object.assign(state, {
    name: props.client.name,
    trade_name: props.client.trade_name ?? '',
    document: props.client.document ?? '',
    email: props.client.email ?? '',
    phone: props.client.phone ?? '',
    address_line: props.client.address_line ?? '',
    address_number: props.client.address_number ?? '',
    address_complement: props.client.address_complement ?? '',
    neighborhood: props.client.neighborhood ?? '',
    city: props.client.city ?? '',
    state: props.client.state ?? '',
    postal_code: props.client.postal_code ?? '',
    latitude: props.client.latitude ?? undefined,
    longitude: props.client.longitude ?? undefined
  })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!activeOrganizationId.value) {
    toast.add({
      title: 'Organização não selecionada',
      description: 'Selecione uma organização antes de salvar o cliente.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
    return
  }

  submitting.value = true

  try {
    const payload = {
      name: event.data.name.trim(),
      trade_name: emptyToNull(event.data.trade_name),
      document: emptyToNull(event.data.document),
      email: emptyToNull(event.data.email),
      phone: emptyToNull(event.data.phone),
      address_line: emptyToNull(event.data.address_line),
      address_number: emptyToNull(event.data.address_number),
      address_complement: emptyToNull(event.data.address_complement),
      neighborhood: emptyToNull(event.data.neighborhood),
      city: emptyToNull(event.data.city),
      state: emptyToNull(event.data.state)?.toUpperCase() ?? null,
      postal_code: emptyToNull(event.data.postal_code),
      latitude: event.data.latitude ?? null,
      longitude: event.data.longitude ?? null,
      updated_at: new Date().toISOString()
    }

    if (props.client) {
      const { error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', props.client.id)
        .eq('organization_id', activeOrganizationId.value)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('clients')
        .insert({
          organization_id: activeOrganizationId.value,
          ...payload
        })

      if (error) throw error
    }

    toast.add({
      title: isEditing.value ? 'Cliente atualizado' : 'Cliente criado',
      description: isEditing.value
        ? 'As alterações foram salvas com sucesso.'
        : 'O cliente foi cadastrado com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    open.value = false
    emit('saved')
  } catch (error) {
    toast.add({
      title: 'Não foi possível salvar o cliente',
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
  [open, () => props.client],
  ([isOpen]) => {
    if (isOpen) resetForm()
  },
  { immediate: true }
)
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :ui="{ content: 'sm:max-w-4xl' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
        <section class="space-y-4">
          <div>
            <h3 class="font-medium text-highlighted">Identificação</h3>
            <p class="text-sm text-muted">Dados comerciais e de contato.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField name="name" label="Razão social / Nome" required>
              <UInput v-model="state.name" placeholder="Nome do cliente" class="w-full" autofocus />
            </UFormField>

            <UFormField name="trade_name" label="Nome fantasia">
              <UInput v-model="state.trade_name" placeholder="Nome fantasia" class="w-full" />
            </UFormField>

            <UFormField name="document" label="CPF / CNPJ">
              <UInput v-model="state.document" placeholder="Documento" class="w-full" />
            </UFormField>

            <UFormField name="phone" label="Telefone">
              <UInput v-model="state.phone" placeholder="(00) 00000-0000" class="w-full" />
            </UFormField>

            <UFormField name="email" label="E-mail" class="sm:col-span-2">
              <UInput v-model="state.email" type="email" placeholder="contato@cliente.com" class="w-full" />
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

          <UButton type="submit" :label="isEditing ? 'Salvar alterações' : 'Criar cliente'" icon="i-lucide-save"
            :loading="submitting" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
