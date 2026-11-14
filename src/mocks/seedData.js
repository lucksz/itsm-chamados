import dataUrl from './data/dados.json?url'

export const initialDataPromise = fetch(dataUrl).then((response) => {
  if (!response.ok) throw new Error('Não foi possível carregar o dataset oficial da demonstração.')
  return response.json()
})
