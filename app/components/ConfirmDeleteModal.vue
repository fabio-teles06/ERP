<script setup lang="ts">
const props = withDefaults(defineProps<{
    title?: string
    description?: string
    itemName?: string | null
    loading?: boolean
}>(), {
    title: 'Confirmar exclusão',
    description: 'Esta ação não poderá ser desfeita.',
    itemName: null,
    loading: false
})

const emit = defineEmits<{
    confirm: []
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
    <UModal v-model:open="open" :title="props.title" :description="props.description">
        <template #body>
            <div class="space-y-5">
                <UAlert color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Confirme a exclusão">
                    <template #description>
                        <span v-if="props.itemName">
                            O registro <strong>{{ props.itemName }}</strong> será removido permanentemente.
                        </span>
                        <span v-else>
                            O registro selecionado será removido permanentemente.
                        </span>
                    </template>
                </UAlert>

                <div class="flex justify-end gap-2">
                    <UButton type="button" label="Cancelar" color="neutral" variant="outline" :disabled="props.loading"
                        @click="() => { open = false }" />

                    <UButton type="button" label="Excluir" icon="i-lucide-trash-2" color="error"
                        :loading="props.loading" @click="emit('confirm')" />
                </div>
            </div>
        </template>
    </UModal>
</template>