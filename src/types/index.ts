export type SensorStatus = "active" | "warning" | "error";

export type Sensor = {
  id: string;
  sectorId: string;
  status: SensorStatus;
  lng: number;
  lat: number;
  temperature: number;
  updatedAt: string;
};

export type FleetUpdatesEvent = {
  type: "fleet-updates";
  sequence: number;
  sentAt: string;
  updates: Sensor[];
};

export type FleetCommandAction =
  | "emergency_shutdown"
  | "firmware_reset"
  | "set_temperature";

export type FleetCommandRequest = {
  sensor_ids: string[];
  action: FleetCommandAction;
  params?: {
    temperature?: number;
  };
  context?: {
    statusFilter?: SensorStatus | "all";
    sectorFilter?: string | null;
    visibleSensorCount?: number;
    selectedSensorCount?: number;
  };
};

export type FleetCommandResponse = {
  status: "accepted";
  commandId: string;
  receivedAt: string;
  affectedSensors: number;
  updatedSensors?: Sensor[];
};

export type SimulateSectorFailureRequest = {
  sectorId?: string;
};

export type SimulateSectorFailureResponse = {
  status: "accepted";
  sectorId: string;
  affectedSensors: number;
  simulatedAt: string;
  updatedSensors: Sensor[];
};

export type PlatformTelemetryEvent = {
  event: "fleet_command_executed";
  data: {
    trigger: {
      view: "fleet_dashboard";
      statusFilter: SensorStatus | "all";
      sectorFilter: string | null;
      visibleSensorCount: number;
      selectedSensorCount: number;
    };
    action: {
      type: FleetCommandAction;
      params?: {
        temperature?: number;
      };
    };
    delta: {
      timeToExecuteMs: number;
    };
    timestamps: {
      firstVisibleAt: string;
      executedAt: string;
    };
    selection: {
      sensorIds: string[];
    };
  };
};
