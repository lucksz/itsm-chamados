import { useEffect, useState } from 'react'
import { now } from '../mocks/demoClock'

export function useDemoClock(interval = 30000) {
  const [currentTime, setCurrentTime] = useState(() => now())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(now()), interval)
    return () => window.clearInterval(timer)
  }, [interval])

  return currentTime
}
