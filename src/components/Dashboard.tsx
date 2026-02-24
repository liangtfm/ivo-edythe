"use client";

import React from "react";

import type {
  FleetCommandAction,
  FleetCommandResponse,
  FleetUpdatesEvent,
  PlatformTelemetryEvent,
  Sensor,
  SensorStatus,
  SimulateSectorFailureResponse,
} from "@/types";

import FleetActions from "./FleetActions";
import FleetView from "./FleetView";

type FrontendIncident = {
  id: string;
  sectorId: string;
  startedAt: string;
  affectedSensors: number;
  resolvedAt?: string;
  resolutionMs?: number;
};

export default function Dashboard() {
  const [fleetData, setFleetData] = React.useState<Sensor[] | null>(null);
  const [visibleSensorIds, setVisibleSensorIds] = React.useState<
    string[] | null
  >(null);
  const [lastAppliedPatches, setLastAppliedPatches] = React.useState<Sensor[]>(
    [],
  );
  const [tableSelectionRequest, setTableSelectionRequest] = React.useState<{
    requestId: number;
    sensorIds: string[];
    source: "sensor" | "cluster";
    preferredStatusFilter?: SensorStatus;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSimulatingFailure, setIsSimulatingFailure] = React.useState(false);
  const [simulationSectorId, setSimulationSectorId] =
    React.useState<string>("");
  const [simulationMessage, setSimulationMessage] = React.useState<
    string | null
  >(null);
  const [incidents, setIncidents] = React.useState<FrontendIncident[]>([]);
  const [telemetryEvents, setTelemetryEvents] = React.useState<
    PlatformTelemetryEvent[]
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  const [streamStatus, setStreamStatus] = React.useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const [lastStreamAt, setLastStreamAt] = React.useState<string | null>(null);

  const pendingUpdatesRef = React.useRef<Map<string, Sensor>>(new Map());
  const seenAtBySensorIdRef = React.useRef<Record<string, number>>({});
  const sensorIndexByIdRef = React.useRef<Map<string, number>>(new Map());
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const hasStartedStreamRef = React.useRef(false);

  const markSensorsSeen = React.useCallback(
    (sensors: Sensor[], seenAt = Date.now()) => {
      const next = seenAtBySensorIdRef.current;
      for (const sensor of sensors) {
        next[sensor.id] = seenAt;
      }
    },
    [],
  );

  const applyLocalPatches = React.useCallback(
    (patches: Sensor[]) => {
      if (!patches.length) return;

      markSensorsSeen(patches);
      React.startTransition(() => {
        setFleetData((previous) => {
          if (!previous) return previous;
          const next = previous.slice();
          const indexById = sensorIndexByIdRef.current;

          for (const patch of patches) {
            const index = indexById.get(patch.id);
            if (index === undefined) continue;
            next[index] = patch;
          }

          return next;
        });
        setLastAppliedPatches(patches);
      });
    },
    [markSensorsSeen],
  );

  const flushPendingUpdates = React.useCallback(() => {
    const pendingById = pendingUpdatesRef.current;
    if (pendingById.size === 0) return;

    const patches = [...pendingById.values()];
    pendingUpdatesRef.current = new Map();

    applyLocalPatches(patches);
  }, [applyLocalPatches]);

  React.useEffect(() => {
    const fetchFleetData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/fleet");
        if (!response.ok) {
          throw new Error(`Initial fleet fetch failed (${response.status})`);
        }
        const responseData = await response.json();
        const sensors = responseData.data as Sensor[];
        sensorIndexByIdRef.current = new Map(
          sensors.map((sensor, index) => [sensor.id, index]),
        );
        markSensorsSeen(sensors);
        setFleetData(sensors);
        const sectors = Array.isArray(responseData.sectors)
          ? responseData.sectors.filter(
              (sector: unknown): sector is string => typeof sector === "string",
            )
          : [];
        if (sectors.length > 0) {
          setSimulationSectorId((current) => current || sectors[0]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown fetch error";
        setError(message);
        console.error("Error fetching fleet data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFleetData();
  }, [markSensorsSeen]);

  React.useEffect(() => {
    const intervalId = window.setInterval(flushPendingUpdates, 500);
    return () => window.clearInterval(intervalId);
  }, [flushPendingUpdates]);

  const hasInitialFleetData = fleetData !== null;

  React.useEffect(() => {
    if (
      !hasInitialFleetData ||
      hasStartedStreamRef.current ||
      eventSourceRef.current
    ) {
      return;
    }

    setStreamStatus("connecting");
    hasStartedStreamRef.current = true;

    const source = new EventSource(
      "/api/fleet/updates?batchSize=120&intervalMs=1000",
    );
    eventSourceRef.current = source;

    source.addEventListener("connected", () => {
      setStreamStatus("connected");
    });

    source.addEventListener("fleet-updates", (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent<string>).data,
        ) as FleetUpdatesEvent;
        markSensorsSeen(payload.updates);
        const pendingById = pendingUpdatesRef.current;
        for (const update of payload.updates) {
          pendingById.set(update.id, update);
        }
        setLastStreamAt(payload.sentAt);
        setStreamStatus("connected");
      } catch (streamError) {
        console.error("Failed to parse fleet updates event", streamError);
      }
    });

    source.onerror = () => {
      setStreamStatus("error");
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
      setStreamStatus("disconnected");
    };
  }, [hasInitialFleetData, markSensorsSeen]);

  const visibleFleetData = React.useMemo(() => {
    if (!fleetData) return null;
    if (!visibleSensorIds) return fleetData;

    const visibleSet = new Set(visibleSensorIds);
    return fleetData.filter((sensor) => visibleSet.has(sensor.id));
  }, [fleetData, visibleSensorIds]);

  const summary = React.useMemo(() => {
    const sensors = fleetData ?? [];
    const counts = { active: 0, warning: 0, error: 0 };

    for (const sensor of sensors) {
      counts[sensor.status] += 1;
    }

    return {
      total: sensors.length,
      ...counts,
    };
  }, [fleetData]);

  const getSensorSeenAt = React.useCallback(
    (sensorId: string) => seenAtBySensorIdRef.current[sensorId],
    [],
  );

  const handleMapSelection = React.useCallback(
    (selection: {
      sensorIds: string[];
      source: "sensor" | "cluster";
      preferredStatusFilter?: SensorStatus;
    }) => {
      if (!selection.sensorIds.length) return;

      setTableSelectionRequest({
        requestId: Date.now(),
        sensorIds: selection.sensorIds,
        source: selection.source,
        preferredStatusFilter: selection.preferredStatusFilter,
      });
    },
    [],
  );

  const sectorOptions = React.useMemo(() => {
    if (!fleetData) return [];
    return [...new Set(fleetData.map((sensor) => sensor.sectorId))].sort();
  }, [fleetData]);

  const handleSimulateSectorFailure = React.useCallback(async () => {
    setIsSimulatingFailure(true);
    setSimulationMessage(null);
    try {
      const response = await fetch("/api/fleet/simulate-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId: simulationSectorId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed (${response.status})`);
      }

      const result = (await response.json()) as SimulateSectorFailureResponse;
      applyLocalPatches(result.updatedSensors);
      setSimulationSectorId(result.sectorId);
      setIncidents((previous) => [
        {
          id: `incident_${result.simulatedAt}_${result.sectorId}`,
          sectorId: result.sectorId,
          startedAt: result.simulatedAt,
          affectedSensors: result.affectedSensors,
        },
        ...previous,
      ]);
      setSimulationMessage(
        `Simulated failure in ${result.sectorId} (${result.affectedSensors} sensors, >80% critical).`,
      );
    } catch (error) {
      setSimulationMessage(
        error instanceof Error ? error.message : "Unknown simulation error",
      );
    } finally {
      setIsSimulatingFailure(false);
    }
  }, [applyLocalPatches, simulationSectorId]);

  const handleCommandAccepted = React.useCallback(
    ({
      action,
      response,
    }: {
      action: FleetCommandAction;
      response: FleetCommandResponse;
    }) => {
      if (response.updatedSensors?.length) {
        applyLocalPatches(response.updatedSensors);
        if (response.updatedSensors.length > 0) {
          const affectedSectors = new Set(
            response.updatedSensors.map((sensor) => sensor.sectorId),
          );
          if (affectedSectors.size > 0) {
            setSimulationMessage(
              action === "emergency_shutdown"
                ? `Emergency action normalized sensors in ${[...affectedSectors].join(", ")}.`
                : `${action} applied to sensors in ${[...affectedSectors].join(", ")}.`,
            );
          }

          if (action === "emergency_shutdown") {
            const nowMs = Date.now();
            setIncidents((previous) =>
              previous.map((incident) => {
                if (incident.resolvedAt) return incident;
                if (!affectedSectors.has(incident.sectorId)) return incident;
                return {
                  ...incident,
                  resolvedAt: new Date(nowMs).toISOString(),
                  resolutionMs: nowMs - new Date(incident.startedAt).getTime(),
                };
              }),
            );
          }
        }
      }
    },
    [applyLocalPatches],
  );

  const handleTelemetryRecorded = React.useCallback(
    (event: PlatformTelemetryEvent) => {
      setTelemetryEvents((previous) => [event, ...previous].slice(0, 20));
    },
    [],
  );

  const telemetrySummary = React.useMemo(() => {
    const resolvedIncidents = incidents.filter(
      (incident) => typeof incident.resolutionMs === "number",
    );
    const activeIncidents = incidents.filter(
      (incident) => !incident.resolvedAt,
    );
    const resolutionValues = resolvedIncidents
      .map((incident) => incident.resolutionMs)
      .filter((value): value is number => typeof value === "number");
    const avgResolutionMs =
      resolutionValues.length > 0
        ? Math.round(
            resolutionValues.reduce((sum, value) => sum + value, 0) /
              resolutionValues.length,
          )
        : null;
    const latestResolutionMs =
      resolvedIncidents.length > 0
        ? (resolvedIncidents
            .slice()
            .sort(
              (a, b) =>
                new Date(b.resolvedAt ?? 0).getTime() -
                new Date(a.resolvedAt ?? 0).getTime(),
            )[0]?.resolutionMs ?? null)
        : null;

    const latestReactionMs =
      telemetryEvents[0]?.data.delta.timeToExecuteMs ?? null;
    const avgReactionMs =
      telemetryEvents.length > 0
        ? Math.round(
            telemetryEvents.reduce(
              (sum, event) => sum + event.data.delta.timeToExecuteMs,
              0,
            ) / telemetryEvents.length,
          )
        : null;

    return {
      activeIncidents,
      resolvedIncidents,
      avgResolutionMs,
      latestResolutionMs,
      latestReactionMs,
      avgReactionMs,
    };
  }, [incidents, telemetryEvents]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Fleet Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live health overview, filtering, and batch command execution.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <StatChip label="Total" value={summary.total} tone="default" />
          <StatChip label="Active" value={summary.active} tone="green" />
          <StatChip label="Warning" value={summary.warning} tone="amber" />
          <StatChip label="Critical" value={summary.error} tone="red" />
          <StatChip
            label="Stream"
            value={streamStatus}
            tone={
              streamStatus === "connected"
                ? "green"
                : streamStatus === "connecting"
                  ? "amber"
                  : "red"
            }
          />
        </div>
      </div>

      {lastStreamAt ? (
        <p className="text-xs text-muted-foreground">
          Last update batch: {new Date(lastStreamAt).toLocaleTimeString()}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex min-w-52 flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Failure Simulation Sector
          </label>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={simulationSectorId}
            onChange={(event) => setSimulationSectorId(event.target.value)}
            disabled={sectorOptions.length === 0 || isSimulatingFailure}
          >
            {sectorOptions.map((sectorId) => (
              <option key={sectorId} value={sectorId}>
                {sectorId}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="h-8 rounded-lg border border-rose-300 bg-rose-50 px-3 text-sm font-medium text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleSimulateSectorFailure()}
          disabled={!simulationSectorId || isSimulatingFailure || isLoading}
        >
          {isSimulatingFailure ? "Simulating..." : "Simulate Sector Failure"}
        </button>
        {simulationMessage ? (
          <p className="text-sm text-muted-foreground">{simulationMessage}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Frontend Telemetry</h2>
            <p className="text-sm text-muted-foreground">
              Operator reaction time and time-to-resolution captured in the UI.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {telemetryEvents.length} recent command telemetry events
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <MetricTile
            label="Active Incidents"
            value={telemetrySummary.activeIncidents.length}
          />
          <MetricTile
            label="Resolved Incidents"
            value={telemetrySummary.resolvedIncidents.length}
          />
          <MetricTile
            label="Latest TTR"
            value={formatMs(telemetrySummary.latestResolutionMs)}
          />
          <MetricTile
            label="Avg TTR"
            value={formatMs(telemetrySummary.avgResolutionMs)}
          />
          <MetricTile
            label="Latest Reaction"
            value={formatMs(telemetrySummary.latestReactionMs)}
          />
          <MetricTile
            label="Avg Reaction"
            value={formatMs(telemetrySummary.avgReactionMs)}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-medium">Open/Recent Incidents</h3>
            <div className="space-y-2 text-sm">
              {incidents.slice(0, 5).map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <div>
                    <div className="font-medium">{incident.sectorId}</div>
                    <div className="text-xs text-muted-foreground">
                      {incident.affectedSensors} sensors ·{" "}
                      {new Date(incident.startedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        incident.resolvedAt
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    >
                      {incident.resolvedAt ? "Resolved" : "Active"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMs(incident.resolutionMs)}
                    </div>
                  </div>
                </div>
              ))}
              {incidents.length === 0 ? (
                <p className="text-muted-foreground">
                  No incidents yet. Simulate a sector failure to start tracking.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-medium">
              Recent Command Telemetry
            </h3>
            <div className="space-y-2 text-sm">
              {telemetryEvents.slice(0, 5).map((event, index) => (
                <div
                  key={`${event.data.timestamps.executedAt}_${index}`}
                  className="rounded-md border border-border px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {event.data.action.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMs(event.data.delta.timeToExecuteMs)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {event.data.trigger.sectorFilter ?? "all sectors"} ·{" "}
                    {event.data.trigger.selectedSensorCount} selected ·{" "}
                    {new Date(
                      event.data.timestamps.executedAt,
                    ).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {telemetryEvents.length === 0 ? (
                <p className="text-muted-foreground">
                  No command telemetry yet. Execute an action to populate this
                  feed.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <FleetView
        fleetData={fleetData}
        latestPatches={lastAppliedPatches}
        onVisibleSensorIdsChange={setVisibleSensorIds}
        onSelectSensors={handleMapSelection}
      />

      <FleetActions
        fleetData={visibleFleetData}
        totalFleetCount={fleetData?.length ?? 0}
        visibleFleetCount={visibleFleetData?.length ?? 0}
        isLoading={isLoading}
        getSensorSeenAt={getSensorSeenAt}
        selectionRequest={tableSelectionRequest}
        onCommandAccepted={handleCommandAccepted}
        onTelemetryRecorded={handleTelemetryRecorded}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function formatMs(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "default" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-300/60 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-300/60 bg-amber-50 text-amber-900"
        : tone === "red"
          ? "border-rose-300/60 bg-rose-50 text-rose-900"
          : "border-border bg-card";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
