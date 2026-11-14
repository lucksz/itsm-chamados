export function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false
  if (user.perfil === 'gestor') return true
  if (user.perfil === 'consultor') {
    const groups = user.grupos_ids || [user.grupo_id]
    return groups.includes(ticket.grupo_id)
  }
  return user.perfil === 'cliente' && ticket.solicitante_id === user.id
}

export function visibleMessagesFor(user, messages) {
  return user?.perfil === 'cliente' ? messages.filter((message) => !message.interna) : messages
}
