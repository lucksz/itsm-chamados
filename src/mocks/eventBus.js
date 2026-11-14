const subscribers = new Set()
const processed = new Set()
const channel = typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function'
  ? null
  : new window.BroadcastChannel('itsm-demo-events-v1')

function deliver(event) {
  if (!event?.id || processed.has(event.id)) return false
  processed.add(event.id)
  subscribers.forEach((subscriber) => subscriber(event))
  return true
}

function broadcastPayload(event) {
  const ticketId = event.tipo === 'chamado.aberto'
    ? event.payload?.id
    : event.payload?.chamado_id
  if (event.tipo === 'mensagem.adicionada') {
    return {
      ...event,
      payload: {
        id: event.payload?.id,
        chamado_id: ticketId,
        autor_id: event.payload?.autor_id,
        interna: Boolean(event.payload?.interna),
      },
    }
  }
  return { ...event, payload: { chamado_id: ticketId } }
}

if (channel) {
  channel.addEventListener('message', ({ data }) => {
    window.setTimeout(() => deliver(data), 0)
  })
}

export const eventBus = {
  subscribe(subscriber) {
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  },
  emit(event) {
    if (!deliver(event)) return false
    channel?.postMessage(broadcastPayload(event))
    return true
  },
  close() {
    channel?.close()
    subscribers.clear()
  },
}

export function createEvent(type, payload, occurredAt) {
  return {
    id: crypto.randomUUID(),
    tipo: type,
    ocorrido_em: new Date(occurredAt).toISOString(),
    payload,
  }
}
