import type { Sensor, SensorStatus } from '../types'

const OUTPUT_PATH = './src/data/mock-data.json'
const NUM_MOCK_DATA = 10000
const INITIAL_MAP_BOUNDS = {
  minLng: -122.02,
  maxLng: -121.74,
  minLat: 37.2,
  maxLat: 37.42,
}

const getStatus = (): SensorStatus => {
  const rand = Math.random()
  if (rand < 0.8) return 'active'
  if (rand < 0.9) return 'warning'
  return 'error'
}

const createSensors = async () => {
  const data: Sensor[] = []
  for (let i = 1; i <= NUM_MOCK_DATA; i++) {
    const sensor = {
      id: `sensor-${i}`,
      sectorId: `sector-${Math.ceil(i / 100)}`,
      status: getStatus(),
      lng: parseFloat(
        (
          INITIAL_MAP_BOUNDS.minLng +
          Math.random() *
            (INITIAL_MAP_BOUNDS.maxLng - INITIAL_MAP_BOUNDS.minLng)
        ).toFixed(6),
      ),
      lat: parseFloat(
        (
          INITIAL_MAP_BOUNDS.minLat +
          Math.random() *
            (INITIAL_MAP_BOUNDS.maxLat - INITIAL_MAP_BOUNDS.minLat)
        ).toFixed(6),
      ),
      temperature: parseFloat((Math.random() * 150).toFixed(2)),
      updatedAt: new Date().toISOString(),
    }
    data.push(sensor)
  }

  await Bun.write(OUTPUT_PATH, JSON.stringify(data, null, 2))

  console.log(`${data.length} mock data generated and saved to ${OUTPUT_PATH}`)
}

createSensors()
