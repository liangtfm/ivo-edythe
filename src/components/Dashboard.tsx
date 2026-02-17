'use client'

import React from 'react'

import FleetActions from './FleetActions'
import FleetView from './FleetView'

export default function Dashboard() {
  const [fleetData, setFleetData] = React.useState<any>(null)

  React.useEffect(() => {
    const fetchFleetData = async () => {
      try {
        const response = await fetch('/api/fleet')
        const responseData = await response.json()
        setFleetData(responseData.data)
      } catch (error) {
        console.error('Error fetching fleet data:', error)
      }
    }

    fetchFleetData()
  }, [])

  return (
    <div className='flex justify-center flex-col p-5'>
      <div className='mb-5'>
        <h1 className='text-3xl text-center font-bold'>Fleet Dashboard</h1>
      </div>
      <FleetView fleetData={fleetData} />
      <FleetActions />
    </div>
  )
}
