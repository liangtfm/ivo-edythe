'use client'

import maplibre from 'maplibre-gl'
import React from 'react'

const MAP_CENTER_LNG = -121.8863
const MAP_CENTER_LAT = 37.3382
const MAP_ZOOM = 10

export default function FleetView() {
  const mapRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!mapRef.current) return

    const map = new maplibre.Map({
      container: mapRef.current,
      style:
        'https://api.maptiler.com/maps/streets-v4/style.json?key=xQIAEzFEJXbomeB7yrEx',
      center: [MAP_CENTER_LNG, MAP_CENTER_LAT],
      zoom: MAP_ZOOM,
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className='p-5 border-gray-900 border-1 rounded-lg mb-8 w-full h-[500px] pb-15'>
      <div ref={mapRef} className='w-full h-full' />
    </div>
  )
}
