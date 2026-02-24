"use client";

import {
  AllCommunityModule,
  type ColDef,
  type GridApi,
  ModuleRegistry,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import React from "react";

import type {
  FleetCommandAction,
  FleetCommandRequest,
  FleetCommandResponse,
  PlatformTelemetryEvent,
  Sensor,
  SensorStatus,
} from "@/types";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

ModuleRegistry.registerModules([AllCommunityModule]);

type GridRow = {
  id: string;
  sectorId: string;
  status: SensorStatus;
  temperature: number;
  updatedAtRaw: string;
  updatedAt: string;
};

type FleetActionsProps = {
  fleetData: Sensor[] | null;
  totalFleetCount: number;
  visibleFleetCount: number;
  isLoading: boolean;
  getSensorSeenAt: (sensorId: string) => number | undefined;
  selectionRequest?: {
    requestId: number;
    sensorIds: string[];
    source: "sensor" | "cluster";
    preferredStatusFilter?: SensorStatus;
  } | null;
  onCommandAccepted?: (payload: {
    action: FleetCommandAction;
    response: FleetCommandResponse;
  }) => void;
  onTelemetryRecorded?: (event: PlatformTelemetryEvent) => void;
};

export default function FleetActions({
  fleetData,
  totalFleetCount,
  visibleFleetCount,
  isLoading,
  getSensorSeenAt,
  selectionRequest,
  onCommandAccepted,
  onTelemetryRecorded,
}: FleetActionsProps) {
  const [selectedSensorIds, setSelectedSensorIds] = React.useState<string[]>(
    [],
  );
  const [statusFilter, setStatusFilter] = React.useState<"all" | SensorStatus>(
    "all",
  );
  const [sectorFilter, setSectorFilter] = React.useState("");
  const [temperatureInput, setTemperatureInput] = React.useState("72");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [isGridReady, setIsGridReady] = React.useState(false);
  const gridApiRef = React.useRef<GridApi<GridRow> | null>(null);
  const lastAppliedSelectionRequestIdRef = React.useRef<number | null>(null);

  const deferredFleetData = React.useDeferredValue(fleetData);
  const deferredSectorFilter = React.useDeferredValue(sectorFilter);

  const columnDefs = React.useMemo<ColDef<GridRow>[]>(
    () => [
      { field: "id", headerName: "ID", minWidth: 150 },
      { field: "sectorId", headerName: "Sector ID", minWidth: 140 },
      { field: "status", headerName: "Status", minWidth: 120 },
      {
        field: "temperature",
        headerName: "Temperature (°C)",
        minWidth: 150,
        valueFormatter: (params) => `${Number(params.value).toFixed(2)}`,
      },
      { field: "updatedAt", headerName: "Last Updated", minWidth: 180 },
    ],
    [],
  );

  const rows = React.useMemo(() => {
    if (!deferredFleetData) return [];

    const normalizedSectorFilter = deferredSectorFilter.trim().toLowerCase();

    return deferredFleetData
      .filter((sensor) => {
        if (statusFilter !== "all" && sensor.status !== statusFilter) {
          return false;
        }

        if (
          normalizedSectorFilter &&
          !sensor.sectorId.toLowerCase().includes(normalizedSectorFilter)
        ) {
          return false;
        }

        return true;
      })
      .map((sensor) => ({
        id: sensor.id,
        sectorId: sensor.sectorId,
        status: sensor.status,
        temperature: sensor.temperature,
        updatedAtRaw: sensor.updatedAt,
        updatedAt: new Date(sensor.updatedAt).toLocaleString(),
      }));
  }, [deferredFleetData, statusFilter, deferredSectorFilter]);

  const statusQuickFilters: Array<{
    label: string;
    value: "all" | SensorStatus;
    toneClass: string;
  }> = [
    {
      label: "All",
      value: "all",
      toneClass: "",
    },
    {
      label: "Active",
      value: "active",
      toneClass: "border-emerald-300 text-emerald-800",
    },
    {
      label: "Warning",
      value: "warning",
      toneClass: "border-amber-300 text-amber-800",
    },
    {
      label: "Critical",
      value: "error",
      toneClass: "border-rose-300 text-rose-800",
    },
  ];

  const selectedCount = selectedSensorIds.length;
  const canExecute = selectedCount > 0 && !isSubmitting;
  const setTemperatureValue = Number(temperatureInput);
  const hasValidTemperature =
    Number.isFinite(setTemperatureValue) && temperatureInput.trim() !== "";

  const onSelectionChange = (selectedIds: string[]) => {
    setSelectedSensorIds(selectedIds);
  };

  React.useEffect(() => {
    if (!selectionRequest) return;
    if (!isGridReady) return;
    if (!gridApiRef.current) return;
    if (
      lastAppliedSelectionRequestIdRef.current === selectionRequest.requestId
    ) {
      return;
    }

    const api = gridApiRef.current;
    const preferredStatusFilter = selectionRequest.preferredStatusFilter;
    if (
      preferredStatusFilter &&
      selectionRequest.source === "cluster" &&
      statusFilter !== preferredStatusFilter
    ) {
      setStatusFilter(preferredStatusFilter);
      setFeedback(
        `Map cluster dominant status detected: ${preferredStatusFilter}. Filter applied.`,
      );
      return;
    }

    const selectionIds = selectionRequest.sensorIds.slice(
      0,
      selectionRequest.source === "cluster" ? 200 : 1,
    );

    api.deselectAll();

    let firstRowIndex: number | null = null;
    for (const id of selectionIds) {
      const rowNode = api.getRowNode(id);
      if (!rowNode) continue;
      rowNode.setSelected(true);
      if (firstRowIndex === null && typeof rowNode.rowIndex === "number") {
        firstRowIndex = rowNode.rowIndex;
      }
    }

    if (firstRowIndex !== null) {
      api.ensureIndexVisible(firstRowIndex);
      setFeedback(
        selectionRequest.source === "sensor"
          ? `Map selected sensor ${selectionIds[0]}`
          : `Map selected ${selectionIds.length} sensors from cluster`,
      );
    } else {
      setFeedback(
        "Map-selected sensors are not in the current table filters/viewport subset.",
      );
    }

    lastAppliedSelectionRequestIdRef.current = selectionRequest.requestId;
  }, [isGridReady, rows, selectionRequest, statusFilter]);

  const executeAction = React.useCallback(
    async (action: FleetCommandAction) => {
      if (!canExecute) return;
      if (action === "set_temperature" && !hasValidTemperature) {
        setFeedback(
          "Enter a valid temperature before sending Set Temperature.",
        );
        return;
      }

      setIsSubmitting(true);
      setFeedback(null);

      const executedAtMs = Date.now();
      const executedAt = new Date(executedAtMs).toISOString();
      const seenAtCandidates = selectedSensorIds
        .map((sensorId) => getSensorSeenAt(sensorId))
        .filter((value): value is number => typeof value === "number");
      const firstVisibleAtMs =
        seenAtCandidates.length > 0
          ? Math.min(...seenAtCandidates)
          : executedAtMs;

      const commandPayload: FleetCommandRequest = {
        sensor_ids: selectedSensorIds,
        action,
        params:
          action === "set_temperature"
            ? { temperature: Number(temperatureInput) }
            : undefined,
        context: {
          statusFilter,
          sectorFilter: sectorFilter.trim() || null,
          visibleSensorCount: visibleFleetCount,
          selectedSensorCount: selectedSensorIds.length,
        },
      };

      const telemetryPayload: PlatformTelemetryEvent = {
        event: "fleet_command_executed",
        data: {
          trigger: {
            view: "fleet_dashboard",
            statusFilter,
            sectorFilter: sectorFilter.trim() || null,
            visibleSensorCount: visibleFleetCount,
            selectedSensorCount: selectedSensorIds.length,
          },
          action: {
            type: action,
            params: commandPayload.params,
          },
          delta: {
            timeToExecuteMs: Math.max(0, executedAtMs - firstVisibleAtMs),
          },
          timestamps: {
            firstVisibleAt: new Date(firstVisibleAtMs).toISOString(),
            executedAt,
          },
          selection: {
            sensorIds: selectedSensorIds,
          },
        },
      };

      try {
        const commandResponse = await fetch("/api/fleet/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commandPayload),
        });

        if (!commandResponse.ok) {
          const errorBody = await commandResponse.json().catch(() => null);
          throw new Error(
            errorBody?.error ??
              `Command request failed (${commandResponse.status})`,
          );
        }

        const result = (await commandResponse.json()) as FleetCommandResponse;
        onCommandAccepted?.({ action, response: result });

        const telemetryResponse = await fetch("/api/platform/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(telemetryPayload),
        });

        if (!telemetryResponse.ok) {
          throw new Error(
            `Telemetry request failed (${telemetryResponse.status}) after command acceptance`,
          );
        }

        onTelemetryRecorded?.(telemetryPayload);

        setFeedback(
          `${result.commandId}: ${action} accepted for ${result.affectedSensors} sensors.`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown command error";
        setFeedback(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canExecute,
      getSensorSeenAt,
      hasValidTemperature,
      sectorFilter,
      selectedSensorIds,
      statusFilter,
      temperatureInput,
      visibleFleetCount,
      onCommandAccepted,
      onTelemetryRecorded,
    ],
  );

  return (
    <div className="flex h-[560px] w-full flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Contextual Commands</h2>
          <p className="text-sm text-muted-foreground">
            Table reflects the map viewport ({visibleFleetCount} visible of{" "}
            {totalFleetCount} total).
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${rows.length} rows after filters`}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_220px_1fr]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status Filter</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | SensorStatus)
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="warning">Warning</option>
            <option value="error">Critical</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Sector Filter</span>
          <Input
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            placeholder="e.g. sector-12"
          />
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Set Temperature (°C)</span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={temperatureInput}
              onChange={(event) => setTemperatureInput(event.target.value)}
              placeholder="72"
            />
          </label>
          <Button
            disabled={!canExecute}
            variant="destructive"
            onClick={() => void executeAction("emergency_shutdown")}
          >
            Emergency Shutdown
          </Button>
          <Button
            disabled={!canExecute}
            variant="outline"
            onClick={() => void executeAction("firmware_reset")}
          >
            Firmware Reset
          </Button>
          <Button
            disabled={!canExecute || !hasValidTemperature}
            onClick={() => void executeAction("set_temperature")}
          >
            Set Temperature
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Quick filters:</span>
        {statusQuickFilters.map((quickFilter) => (
          <Button
            key={quickFilter.value}
            size="sm"
            variant={statusFilter === quickFilter.value ? "default" : "outline"}
            className={
              statusFilter === quickFilter.value ? "" : quickFilter.toneClass
            }
            onClick={() => setStatusFilter(quickFilter.value)}
          >
            {quickFilter.label}
          </Button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-border px-2 py-1">
          Selected: {selectedCount}
        </span>
        <span className="rounded-full border border-border px-2 py-1">
          Visible subset: {visibleFleetCount}
        </span>
        {feedback ? (
          <span className="text-muted-foreground">{feedback}</span>
        ) : null}
      </div>

      <div className="ag-theme-quartz min-h-0 flex-1">
        <AgGridReact
          onGridReady={(event) => {
            gridApiRef.current = event.api;
            setIsGridReady(true);
          }}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          rowSelection={{
            mode: "multiRow",
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
              .map((row) => row.id);
            onSelectionChange(selectedSensorIds);
          }}
        />
      </div>
    </div>
  );
}
