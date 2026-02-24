"use client";

import maplibre, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import React from "react";

import type { Sensor, SensorStatus } from "@/types";

const MAP_CENTER_LNG = -121.8863;
const MAP_CENTER_LAT = 37.3382;
const MAP_ZOOM = 10;
const SOURCE_ID = "sensors";
const CLUSTER_LAYER_ID = "sensor-clusters";
const CLUSTER_COUNT_LAYER_ID = "sensor-cluster-count";
const ACTIVE_LAYER_ID = "sensor-active";
const WARNING_LAYER_ID = "sensor-warning";
const ERROR_LAYER_ID = "sensor-error";

export default function FleetView({
  fleetData,
  latestPatches,
  onVisibleSensorIdsChange,
  onSelectSensors,
}: {
  fleetData: Sensor[] | null;
  latestPatches?: Sensor[];
  onVisibleSensorIdsChange?: (sensorIds: string[] | null) => void;
  onSelectSensors?: (selection: {
    sensorIds: string[];
    source: "sensor" | "cluster";
    preferredStatusFilter?: SensorStatus;
  }) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MLMap | null>(null);
  const handlersBoundRef = React.useRef(false);
  const fleetDataRef = React.useRef<Sensor[] | null>(fleetData);
  const onVisibleSensorIdsChangeRef = React.useRef(onVisibleSensorIdsChange);
  const onSelectSensorsRef = React.useRef(onSelectSensors);
  const featureCollectionRef =
    React.useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const featureIndexByIdRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    fleetDataRef.current = fleetData;
  }, [fleetData]);

  React.useEffect(() => {
    onVisibleSensorIdsChangeRef.current = onVisibleSensorIdsChange;
  }, [onVisibleSensorIdsChange]);

  React.useEffect(() => {
    onSelectSensorsRef.current = onSelectSensors;
  }, [onSelectSensors]);

  const sectorSummary = React.useMemo(() => {
    if (!fleetData) return [];

    const bySector = new Map<
      string,
      { total: number; active: number; warning: number; error: number }
    >();

    for (const sensor of fleetData) {
      const current = bySector.get(sensor.sectorId) ?? {
        total: 0,
        active: 0,
        warning: 0,
        error: 0,
      };
      current.total += 1;
      current[sensor.status] += 1;
      bySector.set(sensor.sectorId, current);
    }

    return [...bySector.entries()]
      .map(([sectorId, counts]) => ({
        sectorId,
        ...counts,
      }))
      .sort(
        (a, b) =>
          b.error - a.error ||
          b.warning - a.warning ||
          a.sectorId.localeCompare(b.sectorId),
      )
      .slice(0, 12);
  }, [fleetData]);

  const ensureSourceAndLayers = React.useCallback((map: MLMap) => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 14,
        clusterProperties: {
          activeCount: [
            "+",
            ["case", ["==", ["get", "status"], "active"], 1, 0],
          ],
          warningCount: [
            "+",
            ["case", ["==", ["get", "status"], "warning"], 1, 0],
          ],
          errorCount: ["+", ["case", ["==", ["get", "status"], "error"], 1, 0]],
        },
      });
    }

    if (!map.getLayer(CLUSTER_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            [
              "all",
              [">=", ["get", "errorCount"], ["get", "warningCount"]],
              [">=", ["get", "errorCount"], ["get", "activeCount"]],
            ],
            "#dc2626",
            [
              "all",
              [">=", ["get", "warningCount"], ["get", "errorCount"]],
              [">=", ["get", "warningCount"], ["get", "activeCount"]],
            ],
            "#f59e0b",
            "#16a34a",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            100,
            22,
            500,
            30,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#0f172a",
        },
      });
    }

    const pointLayerConfig = [
      { id: ACTIVE_LAYER_ID, status: "active", color: "#16a34a" },
      { id: WARNING_LAYER_ID, status: "warning", color: "#f59e0b" },
      { id: ERROR_LAYER_ID, status: "error", color: "#dc2626" },
    ] as const;

    for (const layer of pointLayerConfig) {
      if (map.getLayer(layer.id)) continue;
      map.addLayer({
        id: layer.id,
        type: "circle",
        source: SOURCE_ID,
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["==", ["get", "status"], layer.status],
        ],
        paint: {
          "circle-radius": 4,
          "circle-color": layer.color,
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (handlersBoundRef.current) return;

    map.on("click", CLUSTER_LAYER_ID, (event) => {
      const cluster = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_LAYER_ID],
      })[0];
      const clusterId = cluster?.properties?.cluster_id;
      if (typeof clusterId !== "number") return;

      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      void source?.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (!cluster.geometry || cluster.geometry.type !== "Point") return;
        map.easeTo({
          center: cluster.geometry.coordinates as [number, number],
          zoom,
          duration: 300,
        });
      });

      const pointCount = Number(cluster?.properties?.point_count ?? 0);
      const activeCount = Number(cluster?.properties?.activeCount ?? 0);
      const warningCount = Number(cluster?.properties?.warningCount ?? 0);
      const errorCount = Number(cluster?.properties?.errorCount ?? 0);
      const preferredStatusFilter: SensorStatus =
        errorCount >= warningCount && errorCount >= activeCount
          ? "error"
          : warningCount >= errorCount && warningCount >= activeCount
            ? "warning"
            : "active";

      if (pointCount > 0 && pointCount <= 200) {
        void source
          ?.getClusterLeaves(clusterId, 200, 0)
          .then((leaves) => {
            const sensorIds = leaves
              .map((leaf) => {
                const id = leaf.properties?.id;
                return typeof id === "string" ? id : null;
              })
              .filter((id): id is string => id !== null);

            if (sensorIds.length > 0) {
              onSelectSensorsRef.current?.({
                sensorIds,
                source: "cluster",
                preferredStatusFilter,
              });
            }
          })
          .catch(() => {
            // Ignore cluster leaf lookup failures; zoom still works.
          });
      }
    });

    const sensorClickHandler = (event: maplibre.MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: [ACTIVE_LAYER_ID, WARNING_LAYER_ID, ERROR_LAYER_ID],
      })[0];
      const sensorId = feature?.properties?.id;

      if (typeof sensorId !== "string") return;

      onSelectSensorsRef.current?.({
        sensorIds: [sensorId],
        source: "sensor",
      });
    };

    for (const sensorLayerId of [
      ACTIVE_LAYER_ID,
      WARNING_LAYER_ID,
      ERROR_LAYER_ID,
    ]) {
      map.on("click", sensorLayerId, sensorClickHandler);
    }

    const sensorLayers = [ACTIVE_LAYER_ID, WARNING_LAYER_ID, ERROR_LAYER_ID];
    for (const layerId of [CLUSTER_LAYER_ID, ...sensorLayers]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    handlersBoundRef.current = true;
  }, []);

  const emitVisibleSensorIds = React.useCallback(() => {
    const visibleChangeHandler = onVisibleSensorIdsChangeRef.current;
    if (!visibleChangeHandler) return;

    const map = mapRef.current;
    const latestFleetData = fleetDataRef.current;

    if (!map || !latestFleetData) {
      visibleChangeHandler(null);
      return;
    }

    const bounds = map.getBounds();
    if (!bounds) {
      visibleChangeHandler(null);
      return;
    }

    const visible = latestFleetData
      .filter((sensor) => bounds.contains([sensor.lng, sensor.lat]))
      .map((sensor) => sensor.id);

    visibleChangeHandler(visible);
  }, []);

  const buildFeatureCollection = React.useCallback((sensors: Sensor[]) => {
    featureIndexByIdRef.current = new Map(
      sensors.map((sensor, index) => [sensor.id, index]),
    );

    featureCollectionRef.current = {
      type: "FeatureCollection",
      features: sensors.map((sensor) => ({
        type: "Feature",
        geometry: {
          type: "Point",
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
    };
  }, []);

  const syncSourceData = React.useCallback(() => {
    const map = mapRef.current;
    const featureCollection = featureCollectionRef.current;
    if (!map || !featureCollection) return;

    if (map.isStyleLoaded()) {
      ensureSourceAndLayers(map);
    }

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection);
    emitVisibleSensorIds();
  }, [emitVisibleSensorIds, ensureSourceAndLayers]);

  React.useEffect(() => {
    if (!fleetData) return;

    const current = featureCollectionRef.current;
    if (!current || current.features.length !== fleetData.length) {
      buildFeatureCollection(fleetData);
      syncSourceData();
    }
  }, [buildFeatureCollection, fleetData, syncSourceData]);

  React.useEffect(() => {
    if (!latestPatches?.length) return;

    const featureCollection = featureCollectionRef.current;
    if (!featureCollection) return;

    const indexById = featureIndexByIdRef.current;

    for (const patch of latestPatches) {
      const index = indexById.get(patch.id);
      if (index === undefined) continue;

      const feature = featureCollection.features[index];
      if (!feature || feature.geometry.type !== "Point") continue;

      feature.geometry.coordinates = [patch.lng, patch.lat];
      feature.properties = {
        ...(feature.properties ?? {}),
        id: patch.id,
        status: patch.status,
        temperature: patch.temperature,
        sectorId: patch.sectorId,
        updatedAt: patch.updatedAt,
      };
    }

    syncSourceData();
  }, [latestPatches, syncSourceData]);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibre.Map({
      container: containerRef.current,
      style:
        "https://api.maptiler.com/maps/streets-v4/style.json?key=xQIAEzFEJXbomeB7yrEx",
      center: [MAP_CENTER_LNG, MAP_CENTER_LAT],
      zoom: MAP_ZOOM,
    });

    mapRef.current = map;
    map.addControl(new maplibre.NavigationControl(), "top-right");

    const handleMapReady = () => {
      ensureSourceAndLayers(map);
      syncSourceData();
    };

    if (map.isStyleLoaded()) {
      handleMapReady();
    } else {
      map.on("load", handleMapReady);
    }

    map.on("moveend", emitVisibleSensorIds);

    return () => {
      map.off("moveend", emitVisibleSensorIds);
      map.remove();
      mapRef.current = null;
      handlersBoundRef.current = false;
    };
  }, [emitVisibleSensorIds, ensureSourceAndLayers, syncSourceData]);

  React.useEffect(() => {
    syncSourceData();
  }, [syncSourceData]);

  return (
    <div className="mb-2 w-full rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Macro View</h2>
          <p className="text-sm text-muted-foreground">
            Clustered map + sector traffic-light summary for fast triage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <LegendDot color="bg-emerald-500" label="Active" />
          <LegendDot color="bg-amber-500" label="Warning" />
          <LegendDot color="bg-rose-600" label="Critical" />
          <LegendDot color="bg-blue-500" label="Clustered" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {sectorSummary.map((sector) => (
          <div
            key={sector.sectorId}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="truncate text-xs font-medium">
              {sector.sectorId}
            </div>
            <div className="mt-1 flex gap-1 text-[11px]">
              <Pill tone="green" value={sector.active} />
              <Pill tone="amber" value={sector.warning} />
              <Pill tone="red" value={sector.error} />
            </div>
          </div>
        ))}
      </div>

      <div className="h-[520px] w-full overflow-hidden rounded-lg border border-border">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
      <span className={`size-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function Pill({
  tone,
  value,
}: {
  tone: "green" | "amber" | "red";
  value: number;
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";

  return (
    <span className={`rounded-full px-1.5 py-0.5 font-medium ${toneClass}`}>
      {value}
    </span>
  );
}
