import mockdata from "@/data/mock-data.json";

import type {
  FleetCommandAction,
  FleetCommandRequest,
  Sensor,
  SensorStatus,
} from "@/types";

type FailureProfile = {
  errorRate: number;
  warningRate: number;
};

const DEFAULT_FAILURE_PROFILE: FailureProfile = {
  errorRate: 0.88,
  warningRate: 0.1,
};

const baseFleet = (mockdata as Sensor[]).map((sensor) => ({ ...sensor }));
const fleet = baseFleet.map((sensor) => ({ ...sensor }));
const sensorIndexById = new Map(
  fleet.map((sensor, index) => [sensor.id, index]),
);
const failureSectors = new Map<string, FailureProfile>();

function nowIso() {
  return new Date().toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickStatusForSector(
  sectorId: string,
  fallback: SensorStatus,
): SensorStatus {
  const profile = failureSectors.get(sectorId);
  if (!profile) {
    const roll = Math.random();
    if (roll < 0.75) return "active";
    if (roll < 0.93) return "warning";
    if (fallback === "error" && roll < 0.98) return "warning";
    return "error";
  }

  const roll = Math.random();
  if (roll < profile.errorRate) return "error";
  if (roll < profile.errorRate + profile.warningRate) return "warning";
  return "active";
}

function temperatureForStatus(status: SensorStatus) {
  if (status === "active") return Number((45 + Math.random() * 20).toFixed(2));
  if (status === "warning") return Number((75 + Math.random() * 20).toFixed(2));
  return Number((100 + Math.random() * 35).toFixed(2));
}

function patchSensor(index: number, patch: Partial<Sensor>): Sensor {
  const next = {
    ...fleet[index],
    ...patch,
    updatedAt: patch.updatedAt ?? nowIso(),
  };
  fleet[index] = next;
  return next;
}

export function getFleetSnapshot(): Sensor[] {
  return fleet.map((sensor) => ({ ...sensor }));
}

export function getFleetSectorIds(): string[] {
  return [...new Set(fleet.map((sensor) => sensor.sectorId))].sort();
}

export function generateRandomUpdateBatch(batchSize: number): Sensor[] {
  const count = Math.min(batchSize, fleet.length);
  const chosen = new Set<number>();

  while (chosen.size < count) {
    chosen.add(Math.floor(Math.random() * fleet.length));
  }

  const timestamp = nowIso();

  return [...chosen].map((index) => {
    const current = fleet[index];
    const status = pickStatusForSector(current.sectorId, current.status);
    return patchSensor(index, {
      status,
      temperature: temperatureForStatus(status),
      updatedAt: timestamp,
    });
  });
}

export function simulateSectorFailure(sectorId?: string): {
  sectorId: string;
  updatedSensors: Sensor[];
} {
  const availableSectors = getFleetSectorIds();
  const resolvedSectorId =
    sectorId && availableSectors.includes(sectorId)
      ? sectorId
      : availableSectors[Math.floor(Math.random() * availableSectors.length)];

  failureSectors.set(resolvedSectorId, DEFAULT_FAILURE_PROFILE);

  const timestamp = nowIso();
  const updatedSensors: Sensor[] = [];

  for (let index = 0; index < fleet.length; index += 1) {
    const sensor = fleet[index];
    if (sensor.sectorId !== resolvedSectorId) continue;

    const status = pickStatusForSector(sensor.sectorId, sensor.status);
    updatedSensors.push(
      patchSensor(index, {
        status,
        temperature:
          status === "error"
            ? Number((110 + Math.random() * 25).toFixed(2))
            : temperatureForStatus(status),
        updatedAt: timestamp,
      }),
    );
  }

  return {
    sectorId: resolvedSectorId,
    updatedSensors,
  };
}

export function applyFleetCommandMutation(
  payload: FleetCommandRequest,
): Sensor[] {
  const timestamp = nowIso();
  const touchedSectors = new Set<string>();
  const updatedSensors: Sensor[] = [];
  const seenIds = new Set<string>();

  for (const sensorId of payload.sensor_ids) {
    if (seenIds.has(sensorId)) continue;
    seenIds.add(sensorId);

    const index = sensorIndexById.get(sensorId);
    if (index === undefined) continue;

    const current = fleet[index];
    touchedSectors.add(current.sectorId);

    let patch: Partial<Sensor> | null = null;
    if (payload.action === "emergency_shutdown") {
      patch = {
        status: "active",
        temperature: Number((48 + Math.random() * 8).toFixed(2)),
        updatedAt: timestamp,
      };
    }

    if (payload.action === "firmware_reset") {
      patch = {
        status: Math.random() < 0.85 ? "active" : "warning",
        temperature: Number((55 + Math.random() * 12).toFixed(2)),
        updatedAt: timestamp,
      };
    }

    if (payload.action === "set_temperature") {
      const targetTemp = clamp(
        payload.params?.temperature ?? current.temperature,
        -50,
        200,
      );
      patch = {
        temperature: targetTemp,
        status:
          targetTemp >= 100 ? "error" : targetTemp >= 75 ? "warning" : "active",
        updatedAt: timestamp,
      };
    }

    if (!patch) continue;
    updatedSensors.push(patchSensor(index, patch));
  }

  if (payload.action === "emergency_shutdown") {
    for (const sectorId of touchedSectors) {
      failureSectors.delete(sectorId);
    }
  }

  return updatedSensors;
}

export function resetFleetStore() {
  failureSectors.clear();
  for (let i = 0; i < baseFleet.length; i += 1) {
    fleet[i] = { ...baseFleet[i] };
  }
}

export function getFailureSectorIds() {
  return [...failureSectors.keys()];
}
