export function useOrganization() {
  const store = useOrganizationStore()

  return {
    ...storeToRefs(store),

    loadOrganizations: store.loadOrganizations,
    refreshOrganizations: store.refreshOrganizations,
    setActiveOrganization:
      store.setActiveOrganization,
    resetOrganizations: store.reset
  }
}