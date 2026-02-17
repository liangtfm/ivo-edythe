export type SensorStatus = 'active' | 'warning' | 'error'

export type Sensor = {
  id: string
  sectorId: string
  status: SensorStatus
  lng: number
  lat: number
  temperature: number
  updatedAt: string
}
