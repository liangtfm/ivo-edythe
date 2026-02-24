# Strive Frontend/Fullstack Engineer | Take-Home

## Phase 1: Observable Component Library

**Module Time:** 2 Hours (Strict).

**Rules:** No AI tools. We want to see your hand-rolled architecture for event handling.

**Context:** You are building a "Smart Control" module for our drag-and-drop platform.

## The Scenario

We are a platform that replaces manual industrial workflows with digital tools. To prove our value to customers, we don't just execute actions; we measure efficiency.

Our customer operates a fleet of 10,000+ IoT sensors (e.g., solar panels or delivery drones). They currently monitor them using a slow, manual spreadsheet reload process.

**Your Mission:** Build a module that visualizes this live fleet data and allows a non-technical operator to identify issues and fix them in seconds, not hours.

## Core Requirements

### 1. The "Macro" Visualization

The module receives a high-frequency stream of status updates.

**The UX Challenge:** A non-tech user cannot read 10,000 rows of text. You must design a visualization (e.g., a Density Heatmap, a Cluster Map, or a "Traffic Light" Aggregation Grid) that summarizes the fleet's health at a glance.

**The Tech Challenge:** How do you handle the performance? We want to see how you manage the rendering so the browser doesn't freeze.

**Library Strategy:** We value pragmatism. You are free (and encouraged) to use open-source visualization libraries (e.g., Recharts, Visx, Deck.gl, Ag-Grid). In your README, explain why you chose the specific library over others.

### 2. The "Contextual" Command Interface

Visualizing is useless without action; The user needs to "Slice and Dice" to find a problem area, select it, and issue a command.

**The Workflow:**

1. User filters/zooms into a "Red" (Critical) sector.
2. User selects a group of sensors.
3. User issues a command (e.g., "Emergency Shutdown", "Firmware Reset", "Set temperature"...).

You can be creative and come up with other workflows.

**The API:** The command is sent via `POST /api/fleet/command` with the `sensor_ids` and the `action`.

This is just an example, please come up with a list of endpoints for this module to cover its lifecycle in more depth.

### 3. The "Time-Saved" Telemetry (The ROI)

Our platform needs to prove its value. We measure "Time to Resolution."

When the user issues a command, your module must generate a secondary Audit/Telemetry Event sent to `POST /api/platform/telemetry`.

**The Payload:** You must design a JSON structure that captures:

- **The Trigger:** What did the user see? (e.g., "User filtered by 'Overheating'").
- **The Action:** What did they do?
- **The Delta:** How much time passed between the data appearing on screen and the user clicking "Execute"? (This data point allows us to tell the customer: "Your operators react 40% faster using this view.")

## Deliverables

**Code:** A React/TS repo (ideally dockerized). You can mock the "10,000 sensors" with a simple loop generating random data, but the architecture should be ready to handle the real volume.

**Strategy Doc:**

- **Visualization Choice:** Why did you choose a [Heatmap/Grid/Chart]? How does it help a non-tech user?
- **Performance:** How did you prevent the "firehose" of data from blocking the "Command" UI interaction?
