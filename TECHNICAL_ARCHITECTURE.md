# Telemetry Viewer – Technical Architecture

## Overview

The telemetry viewer is a client-side React application that visualizes match telemetry data.

The application loads match telemetry from a JSON dataset and renders a visual replay of the match on a minimap.

The architecture is designed to keep rendering, analytics, and data loading clearly separated.

---

## High Level Architecture

User
 ↓
React UI Layer
 ↓
Telemetry Processing
 ↓
Visualization Engine
 ↓
Map Rendering

---

## Core Components

### App.jsx

Main orchestration component.

Responsibilities:

- Load match telemetry
- Manage replay state
- Manage playback controls
- Trigger analytics computations
- Render map visualization

---

### Telemetry Loader

Data is loaded from:


public/data/matches.json


The loader converts the dataset into:


matches[]
players[]
events[]


---

### Playback Engine

Replay is driven using:


setInterval()


Frame counter increases until the maximum frame length.

Frame index determines:

- Visible player path
- Visible events

---

### Visualization Layer

Visualization is composed of three rendering systems:

1. Map background
2. Player path rendering
3. Event markers

---

### Map Rendering

Minimap images are loaded based on:


map_id


Example:


AmbroseValley → AmbroseValley_Minimap.png


Coordinates are scaled from:


1024 x 1024 world coordinates

→

700 x 700 viewport


---

### Player Path Rendering

Player paths are rendered using:


SVG polyline


Advantages:

- Efficient rendering
- Smooth long paths
- Easy frame slicing

---

### Event Rendering

Events are rendered as:


absolute positioned div markers


Events include:

- kill
- loot
- zone
- position

---

### Heatmap Generation

Movement heatmaps are computed using a grid-based approach.

Steps:

1. Divide map into grid cells
2. Count player visits per cell
3. Render colored overlay cells

---

### Kill Heatmap

Kill locations are mapped to grid cells and visualized as intensity overlays.

---

### Kill Hotspot Detection

Kill clusters are detected using:


K-Means clustering


Steps:

1. Collect kill coordinates
2. Random centroid initialization
3. Iteratively assign cluster
4. Recalculate centroid

Final centroids represent kill hotspots.

---

## Rendering Order

Correct layering ensures visual clarity.

Layer order:

1 Map image  
2 Heatmaps  
3 Player paths  
4 Event markers  
5 Cluster indicators

---

## Performance Considerations

Key optimizations:

- SVG paths instead of many DOM elements
- Precomputed heatmaps
- Limited frame rendering
- Lightweight clustering

---

## Scalability

Current design supports:

- Multiple matches
- Thousands of events
- Long player paths

Possible scaling improvements:

- WebGL rendering
- Spatial indexing
- Progressive event loading