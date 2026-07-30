<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Enums, Tables } from '~/types/database.types'

type Delivery = Tables<'deliveries'>
type DeliveryStatus = Enums<'delivery_status'>
type NumericInput = number | '' | undefined

type Client = Pick<
  Tables<'clients'>,
  | 'id'
  | 'name'
  | 'trade_name'
  | 'document'
  | 'address_line'
  | 'address_number'
  | 'address_complement'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'latitude'
  | 'longitude'
>

const props = defineProps<{
  delivery?: Delivery | null
  clients: Client[]
  loadingClients?: boolean
}>()

const emit = defineEmits<{
  saved: []
  reloadClients: []
}>()

const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const deliveryStatuses = [
  'pending',
  'ready',
  'routed',
  'in_transit',
  'delivered',
  'failed',
  'cancelled'
] as const satisfies readonly DeliveryStatus[]

const deliveryStatusOptions: Array<{ label: string, value: DeliveryStatus }> = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pronta', value: 'ready' },
  { label: 'Roteirizada', value: 'routed' },
  { label: 'Em trânsito', value: 'in_transit' },
  { label: 'Entregue', value: 'delivered' },
  { label: 'Falhou', value: 'failed' },
  { label: 'Cancelada', value: 'cancelled' }
]

const optionalNumber = z.preprocess(
  value => value === '' || value === null || value === undefined
    ? undefined
    : Number(value),
  z.number().finite('Informe um número válido.').optional()
)

const optionalNonNegativeNumber = z.preprocess(
  value => value === '' || value === null || value === undefined
    ? undefined
    : Number(value),
  z.number().finite('Informe um número válido.').min(0, 'O valor não pode ser negativo.').optional()
)

const optionalPositiveInteger = z.preprocess(
  value => value === '' || value === null || value === undefined
    ? undefined
    : Number(value),
  z.number().int('Informe um número inteiro.').min(1, 'A quantidade deve ser maior que zero.').optional()
)

const schema = z.object({
  external_reference: z.string().trim().optional(),
  invoice_number: z.string().trim().optional(),
  invoice_series: z.string().trim().optional(),
  sender_id: z.string().uuid('Selecione um remetente.'),
  recipient_id: z.string().uuid('Selecione um destinatário.'),
  weight: optionalNonNegativeNumber,
  volume: optionalNonNegativeNumber,
  quantity: optionalPositiveInteger,
  status: z.enum(deliveryStatuses),
  address_line: z.string().trim().optional(),
  address_number: z.string().trim().optional(),
  address_complement: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, 'Use a sigla do estado.').optional(),
  postal_code: z.string().trim().optional(),
  latitude: optionalNumber,
  longitude: optionalNumber,
  expected_delivery_date: z.string().optional(),
  scheduled_start_at: z.string().optional(),
  scheduled_end_at: z.string().optional()
}).superRefine((data, ctx) => {
  if (
    data.scheduled_start_at
    && data.scheduled_end_at
    && new Date(data.scheduled_end_at) < new Date(data.scheduled_start_at)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['scheduled_end_at'],
      message: 'O fim do agendamento deve ser posterior ao início.'
    })
  }

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
  external_reference: string
  invoice_number: string
  invoice_series: string
  sender_id: string
  recipient_id: string
  weight: NumericInput
  volume: NumericInput
  quantity: NumericInput
  status: DeliveryStatus
  address_line: string
  address_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
  postal_code: string
  latitude: NumericInput
  longitude: NumericInput
  expected_delivery_date: string
  scheduled_start_at: string
  scheduled_end_at: string
}

function createInitialState(): FormState {
  return {
    external_reference: '',
    invoice_number: '',
    invoice_series: '',
    sender_id: '',
    recipient_id: '',
    weight: undefined,
    volume: undefined,
    quantity: 1,
    status: 'pending',
    address_line: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: undefined,
    longitude: undefined,
    expected_delivery_date: '',
    scheduled_start_at: '',
    scheduled_end_at: ''
  }
}

const state = reactive<FormState>(createInitialState())
const submitting = ref(false)

const isEditing = computed(() => Boolean(props.delivery?.id))
const title = computed(() => isEditing.value ? 'Editar entrega' : 'Nova entrega')
const description = computed(() => isEditing.value
  ? 'Atualize os dados da entrega selecionada.'
  : 'Cadastre a nota, os clientes e o endereço de entrega.'
)

const clientOptions = computed(() => props.clients.map((client) => {
  const displayName = client.trade_name || client.name
  const address = [
    client.address_line,
    client.address_number,
    client.city,
    client.state
  ].filter(Boolean).join(', ')

  return {
    id: client.id,
    label: displayName,
    description: [client.document, address].filter(Boolean).join(' • ')
  }
}))

const selectedRecipient = computed(() => {
  return props.clients.find(client => client.id === state.recipient_id) ?? null
})

function isEmpty(value: string | null | undefined) {
  return !value?.trim()
}

function fillDeliveryAddressFromRecipient(force = false) {
  const recipient = selectedRecipient.value
  if (!recipient) return

  if ((force || isEmpty(state.address_line)) && recipient.address_line) {
    state.address_line = recipient.address_line
  }
  if ((force || isEmpty(state.address_number)) && recipient.address_number) {
    state.address_number = recipient.address_number
  }
  if ((force || isEmpty(state.address_complement)) && recipient.address_complement) {
    state.address_complement = recipient.address_complement
  }
  if ((force || isEmpty(state.neighborhood)) && recipient.neighborhood) {
    state.neighborhood = recipient.neighborhood
  }
  if ((force || isEmpty(state.city)) && recipient.city) {
    state.city = recipient.city
  }
  if ((force || isEmpty(state.state)) && recipient.state) {
    state.state = recipient.state
  }
  if ((force || isEmpty(state.postal_code)) && recipient.postal_code) {
    state.postal_code = recipient.postal_code
  }
  if ((force || state.latitude === undefined || state.latitude === '') && recipient.latitude !== null) {
    state.latitude = recipient.latitude
  }
  if ((force || state.longitude === undefined || state.longitude === '') && recipient.longitude !== null) {
    state.longitude = recipient.longitude
  }
}

function emptyToNull(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function datetimeLocalToIso(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isoToDatetimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function resetForm() {
  Object.assign(state, createInitialState())

  if (!props.delivery) return

  Object.assign(state, {
    external_reference: props.delivery.external_reference ?? '',
    invoice_number: props.delivery.invoice_number ?? '',
    invoice_series: props.delivery.invoice_series ?? '',
    sender_id: props.delivery.sender_id,
    recipient_id: props.delivery.recipient_id,
    weight: Number(props.delivery.weight ?? 0),
    volume: Number(props.delivery.volume ?? 0),
    quantity: props.delivery.quantity,
    status: props.delivery.status,
    address_line: props.delivery.delivery_address ?? '',
    address_number: props.delivery.delivery_number ?? '',
    address_complement: props.delivery.delivery_complement ?? '',
    neighborhood: props.delivery.delivery_neighborhood ?? '',
    city: props.delivery.delivery_city ?? '',
    state: props.delivery.delivery_state ?? '',
    postal_code: props.delivery.delivery_postal_code ?? '',
    latitude: props.delivery.latitude ?? undefined,
    longitude: props.delivery.longitude ?? undefined,
    expected_delivery_date: props.delivery.expected_delivery_date ?? '',
    scheduled_start_at: isoToDatetimeLocal(props.delivery.scheduled_start_at),
    scheduled_end_at: isoToDatetimeLocal(props.delivery.scheduled_end_at)
  })

  fillDeliveryAddressFromRecipient(false)
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

  const recipient = selectedRecipient.value
  submitting.value = true

  try {
    const payload = {
      external_reference: emptyToNull(event.data.external_reference),
      invoice_number: emptyToNull(event.data.invoice_number),
      invoice_series: emptyToNull(event.data.invoice_series),
      sender_id: event.data.sender_id,
      recipient_id: event.data.recipient_id,
      weight: event.data.weight ?? 0,
      volume: event.data.volume ?? 0,
      quantity: event.data.quantity ?? 1,
      status: event.data.status,
      delivery_address: emptyToNull(event.data.address_line) ?? recipient?.address_line ?? null,
      delivery_number: emptyToNull(event.data.address_number) ?? recipient?.address_number ?? null,
      delivery_complement: emptyToNull(event.data.address_complement) ?? recipient?.address_complement ?? null,
      delivery_neighborhood: emptyToNull(event.data.neighborhood) ?? recipient?.neighborhood ?? null,
      delivery_city: emptyToNull(event.data.city) ?? recipient?.city ?? null,
      delivery_state: (
        emptyToNull(event.data.state)
        ?? recipient?.state
        ?? null
      )?.toUpperCase() ?? null,
      delivery_postal_code: emptyToNull(event.data.postal_code) ?? recipient?.postal_code ?? null,
      latitude: event.data.latitude ?? recipient?.latitude ?? null,
      longitude: event.data.longitude ?? recipient?.longitude ?? null,
      expected_delivery_date: event.data.expected_delivery_date || null,
      scheduled_start_at: datetimeLocalToIso(event.data.scheduled_start_at),
      scheduled_end_at: datetimeLocalToIso(event.data.scheduled_end_at),
      updated_at: new Date().toISOString()
    }

    if (props.delivery) {
      const { error } = await supabase
        .from('deliveries')
        .update(payload)
        .eq('id', props.delivery.id)
        .eq('organization_id', activeOrganizationId.value)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('deliveries')
        .insert({
          organization_id: activeOrganizationId.value,
          ...payload
        })

      if (error) throw error
    }

    toast.add({
      title: isEditing.value ? 'Entrega atualizada' : 'Entrega criada',
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
      title: 'Não foi possível salvar a entrega',
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
  [open, () => props.delivery],
  ([isOpen]) => {
    if (isOpen) resetForm()
  },
  { immediate: true }
)

watch(
  () => state.recipient_id,
  () => fillDeliveryAddressFromRecipient(false)
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
            <UFormField name="external_reference" label="Referência externa">
              <UInput v-model="state.external_reference" placeholder="Código externo" class="w-full" />
            </UFormField>

            <UFormField name="invoice_number" label="Nota fiscal">
              <UInput v-model="state.invoice_number" placeholder="Número da nota" class="w-full" />
            </UFormField>

            <UFormField name="invoice_series" label="Série">
              <UInput v-model="state.invoice_series" placeholder="Série" class="w-full" />
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="font-medium text-highlighted">Clientes</h3>
              <p class="text-sm text-muted">Selecione o remetente e o destinatário.</p>
            </div>

            <UButton type="button" label="Atualizar clientes" icon="i-lucide-refresh-cw" color="neutral"
              variant="outline" :loading="props.loadingClients" @click="emit('reloadClients')" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField name="sender_id" label="Remetente" required>
              <USelectMenu v-model="state.sender_id" :items="clientOptions" value-key="id" label-key="label"
                placeholder="Selecione o remetente" icon="i-lucide-building-2" :loading="props.loadingClients"
                :search-input="{ placeholder: 'Pesquisar cliente...', icon: 'i-lucide-search' }" class="w-full">
                <template #item="{ item }">
                  <div class="min-w-0">
                    <p class="truncate font-medium">{{ item.label }}</p>
                    <p class="truncate text-xs text-muted">{{ item.description || 'Sem endereço informado' }}</p>
                  </div>
                </template>
              </USelectMenu>
            </UFormField>

            <UFormField name="recipient_id" label="Destinatário" required>
              <USelectMenu v-model="state.recipient_id" :items="clientOptions" value-key="id" label-key="label"
                placeholder="Selecione o destinatário" icon="i-lucide-map-pin" :loading="props.loadingClients"
                :search-input="{ placeholder: 'Pesquisar cliente...', icon: 'i-lucide-search' }" class="w-full">
                <template #item="{ item }">
                  <div class="min-w-0">
                    <p class="truncate font-medium">{{ item.label }}</p>
                    <p class="truncate text-xs text-muted">{{ item.description || 'Sem endereço informado' }}</p>
                  </div>
                </template>
              </USelectMenu>
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <div>
            <h3 class="font-medium text-highlighted">Carga</h3>
            <p class="text-sm text-muted">Peso, volume, quantidade e situação atual.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-4">
            <UFormField name="weight" label="Peso (kg)">
              <UInput v-model="state.weight" type="number" min="0" step="0.01" placeholder="0" class="w-full" />
            </UFormField>

            <UFormField name="volume" label="Volume (m³)">
              <UInput v-model="state.volume" type="number" min="0" step="0.01" placeholder="0" class="w-full" />
            </UFormField>

            <UFormField name="quantity" label="Quantidade">
              <UInput v-model="state.quantity" type="number" min="1" step="1" placeholder="1" class="w-full" />
            </UFormField>

            <UFormField name="status" label="Status" required>
              <USelect v-model="state.status" :items="deliveryStatusOptions" value-key="value" label-key="label"
                class="w-full" />
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <div>
            <h3 class="font-medium text-highlighted">Coordenadas e datas</h3>
            <p class="text-sm text-muted">Previsão e janela de agendamento.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <UFormField name="expected_delivery_date" label="Previsão">
              <UInput v-model="state.expected_delivery_date" type="date" class="w-full" />
            </UFormField>

            <UFormField name="scheduled_start_at" label="Início agendado">
              <UInput v-model="state.scheduled_start_at" type="datetime-local" class="w-full" />
            </UFormField>

            <UFormField name="scheduled_end_at" label="Fim agendado">
              <UInput v-model="state.scheduled_end_at" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
        </section>

        <USeparator />

        <section class="space-y-4">
          <AddressInput v-model:state="state" :fill="fillDeliveryAddressFromRecipient" />
        </section>

        <div class="flex justify-end gap-2 border-t border-default pt-5">
          <UButton type="button" label="Cancelar" color="neutral" variant="outline" :disabled="submitting"
            @click="() => { open = false }" />

          <UButton type="submit" :label="isEditing ? 'Salvar alterações' : 'Criar entrega'" icon="i-lucide-save"
            :loading="submitting" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
