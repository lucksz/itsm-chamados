import { initialDataPromise } from './seedData'
import { getDemoNow } from '../domain/tickets'

const sessionStartedAt = Date.now()
let referenceTime
export const clockReady = initialDataPromise.then((data) => {
  referenceTime = data.meta.agora
})

export function now() {
  if (!referenceTime) throw new Error('O relógio da demonstração ainda não foi inicializado.')
  return getDemoNow(referenceTime, sessionStartedAt)
}

export function initialTime() {
  if (!referenceTime) throw new Error('O relógio da demonstração ainda não foi inicializado.')
  return referenceTime
}
