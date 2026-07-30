export default defineNuxtPlugin(async () => {
  const organizationStore = useOrganizationStore()

  await organizationStore.initialize()
})