import type { WeatherSnapshot } from '../types/domain'

export const siteInfo = {
  name: 'Sector 7 Quarry',
  activePit: 'Sector 7 Quarry - Pit North',
  latency: '8ms',
}

export const mockWeather: WeatherSnapshot = {
  condition: 'sunny',
  tempC: 31,
  windKt: 8,
  humidityPct: 42,
  baroHpa: 1014,
}
