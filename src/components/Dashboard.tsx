'use client'

import FleetActions from './FleetActions'
import FleetView from './FleetView'

export default function Dashboard() {
  return (
    <div className='flex justify-center flex-col p-5'>
      <div className='mb-5'>
        <h1 className='text-3xl text-center font-bold'>Fleet Dashboard</h1>
      </div>
      <FleetView />
      <FleetActions />
    </div>
  )
}
