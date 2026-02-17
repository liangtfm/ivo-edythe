/**
 * FleetActions component displays a data grid of all sensors in the fleet and
 * allows users to select multiple sensors and perform actions on them.
 *
 * TODO:
 *   - Implement the click action for the buttons plus an extra temperature input
 *     for `set temperature` button.
 *   - Click actions also need to send a POST to the telemetry endpoint with
 *     time lapsed since the data point appeared.
 *   - Update table when data changes or map view changes with only the visible
 *     data points.
 */
'use client'

import {
  AllCommunityModule,
  type ColDef,
  ModuleRegistry,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import React from 'react'
import { Button } from './ui/button'

ModuleRegistry.registerModules([AllCommunityModule])

import type { Sensor } from '@/types'

export default function FleetActions({ fleetData }: { fleetData: Sensor[] }) {
  const [selectedSensorIds, setSelectedSensorIds] = React.useState<string[]>([])

  const columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', minWidth: 150 },
    { field: 'sectorId', headerName: 'Sector ID', minWidth: 150 },
    { field: 'status', headerName: 'Status', minWidth: 150 },
    { field: 'temperature', headerName: 'Temperature (°C)', minWidth: 150 },
    { field: 'updatedAt', headerName: 'Last Updated', minWidth: 150 },
  ]

  const rows = React.useMemo(() => {
    if (!fleetData) return []

    return fleetData.map((sensor) => ({
      id: sensor.id,
      sectorId: sensor.sectorId,
      status: sensor.status,
      temperature: sensor.temperature,
      updatedAt: new Date(sensor.updatedAt).toLocaleString(),
    }))
  }, [fleetData])

  const onSelectionChange = (selectedIds: string[]) => {
    setSelectedSensorIds(selectedIds)
  }

  return (
    <div className='flex flex-col p-5 border-slate-700 border rounded-lg w-full h-125'>
      <div className='mb-5 gap-3 flex'>
        <Button disabled={selectedSensorIds.length === 0}>
          Emergency Shutdown
        </Button>
        <Button disabled={selectedSensorIds.length === 0}>
          Firmware Reset
        </Button>
        <Button disabled={selectedSensorIds.length === 0}>
          Set Temperature
        </Button>
      </div>
      <AgGridReact
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
        }}
        rowSelection={{
          mode: 'multiRow',
          checkboxes: true,
          headerCheckbox: true,
          enableClickSelection: true,
        }}
        animateRows
        pagination
        paginationPageSize={50}
        getRowId={(params) => params.data.id}
        onSelectionChanged={(event) => {
          const selectedSensorIds = event.api
            .getSelectedRows()
            .map((row) => row.id)
          onSelectionChange(selectedSensorIds)
        }}
      />
    </div>
  )
}
