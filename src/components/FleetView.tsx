/**
 * FleetView component displays the sensors on a <map name="
 *
 * TODO:
 *  - Display sensors as color-coded circles depending on the status.
 *  - Update the map when new sensor data arrives.
 *  - Make sure sectors and clustering works.
 */
'use client'

import maplibre, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import React from 'react'

import type { Sensor } from '@/types'

const MAP_CENTER_LNG = -121.8863
const MAP_CENTER_LAT = 37.3382
const MAP_ZOOM = 10
const SOURCE_ID = 'sensors'

export default function FleetView({
  fleetData,
}: {
  fleetData: Sensor[] | null
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MLMap | null>(null)

  const dataPoints = React.useMemo(() => {
    if (!fleetData) return []

    return {
      type: 'FeatureCollection',
      features: fleetData.map((sensor) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [sensor.lng, sensor.lat],
        },
        properties: {
          id: sensor.id,
          status: sensor.status,
          temperature: sensor.temperature,
          sectorId: sensor.sectorId,
          updatedAt: sensor.updatedAt,
        },
      })),
    }
  }, [fleetData])

  React.useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const map = new maplibre.Map({
      container: containerRef.current,
      style:
        'https://api.maptiler.com/maps/streets-v4/style.json?key=xQIAEzFEJXbomeB7yrEx',
      center: [MAP_CENTER_LNG, MAP_CENTER_LAT],
      zoom: MAP_ZOOM,
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(dataPoints)
  }, [dataPoints])

  return (
    <div className='p-5 border-gray-900 border rounded-lg mb-8 w-full h-125 pb-15'>
      <div ref={containerRef} className='w-full h-full' />
    </div>
  )
}
