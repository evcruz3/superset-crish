# Layer Signature Unification Project

## Overview
This project aims to unify and standardize the layer signature implementations across all deck.gl layers in the preset-chart-deckgl-osm plugin. The goal is to improve code maintainability, type safety, and developer experience.

## Progress

### ✅ Initial Setup
- [x] Created unified layer type definitions in `src/types/layers.ts`
- [x] Defined base interfaces for layer options
- [x] Added type guards for color scale functionality
- [x] Documented layer types and interfaces
- [x] Updated factory to support unified layer interface directly

### 🚧 Layer Migration Plan
Each layer needs to be migrated to use the new unified `LayerOptions` interface. Here's the current status:

#### Simple Layers (Basic Signature)
- [x] Grid Layer (`deck_grid`) - Completed with direct factory integration
- [ ] Hex Layer (`deck_hex`)
- [ ] Path Layer (`deck_path`)
- [ ] Screengrid Layer (`deck_screengrid`)

#### Complex Layers
- [x] Scatter Layer (`deck_scatter`) - Completed with categorical component support
- [x] Country Layer (`deck_country`) - Completed with geoJson, temporal, and viewState support
- [x] Feed Layer (`deck_feed`) - Completed with geoJson and selection support
- [x] Polygon Layer (`deck_polygon`) - Completed with selection and color scale support
- [ ] Arc Layer (`deck_arc`)
- [ ] Heatmap Layer (`deck_heatmap`)
- [ ] Contour Layer (`deck_contour`)

### 🔄 Migration Process for Each Layer
1. Update layer implementation to use new `LayerOptions` interface
2. Ensure all type definitions are properly imported
3. Test layer functionality with new interface
4. Update any layer-specific types or interfaces
5. Verify no regression in existing features

### 📝 Implementation Notes

#### Factory Improvements
1. Updated `getLayerType` interface to use `LayerOptions`
2. Removed need for wrapper functions in layer implementations
3. Added proper typing for layer return values
4. Improved type safety in component creation
5. Maintained backward compatibility with existing layers

#### Grid Layer Migration (Completed)
1. Removed wrapper function due to improved factory support
2. Implemented color scale support for legend functionality
3. Fixed tooltip type issues
4. Added proper type annotations for data mapping
5. Maintained existing functionality while improving type safety

#### Country Layer Migration (Completed)
1. Updated to use unified `LayerOptions` interface
2. Implemented proper handling of temporal options
3. Added type-safe viewState management
4. Fixed viewport change handling with proper type conversions
5. Maintained all existing functionality including GeoJSON support

#### Scatter Layer Migration (Completed)
1. Updated to use unified `LayerOptions` interface
2. Maintained compatibility with categorical component
3. Fixed type compatibility with factory
4. Improved tooltip content type safety
5. Preserved all existing functionality including radius and color handling

#### Feed Layer Migration (Completed)
1. Updated to use unified `LayerOptions` interface
2. Maintained GeoJSON and selection support
3. Added proper undefined checks for handlers
4. Improved click and hover interaction safety
5. Preserved all existing functionality including region selection and tooltips

#### Polygon Layer Migration (Completed)
1. Updated to use unified `LayerOptions` interface
2. Added proper selection support with type safety
3. Improved color scale implementation
4. Enhanced tooltip content generation
5. Maintained existing functionality including:
   - Polygon selection and toggling
   - Color scaling based on metrics
   - Legend support
   - Elevation handling
   - Table filtering

### 📝 Future Improvements
- [ ] Add unit tests for type guards
- [ ] Create helper functions for common layer operations
- [ ] Add validation for layer options
- [ ] Improve error handling and type checking
- [ ] Add migration guide for custom layer implementations

## Current Layer Signatures

### Base Layer Signature (Simple Layers)
```typescript
function getLayer(options: LayerOptions): LayerReturn {
  const { formData, payload, onAddFilter, setTooltip } = options;
  // Layer implementation
}
```

### Scatter Layer
```typescript
function getLayer(options: LayerOptions): Layer<{}> {
  const { formData, payload, onAddFilter, setTooltip, datasource } = options;
  // Layer implementation with categorical support
}
```

### Country Layer
```typescript
function getLayer(options: LayerOptions): LayerReturn {
  const { 
    formData, 
    payload, 
    onAddFilter, 
    setTooltip, 
    geoJson,
    temporalOptions,
    viewState 
  } = options;
  // Layer implementation
}
```

### Feed Layer
```typescript
function getLayer(options: LayerOptions): (Layer<{}> | (() => Layer<{}>))[] {
  const { 
    formData, 
    payload, 
    onAddFilter, 
    setTooltip,
    geoJson,
    selectionOptions: { setSelectedRegion, selectedRegion }
  } = options;
  // Layer implementation with region selection
}
```

### Polygon Layer
```typescript
function getLayer(options: LayerOptions): Layer<{}> {
  const { 
    formData, 
    payload, 
    onAddFilter, 
    setTooltip,
    selectionOptions: { selected, onSelect }
  } = options;
  // Layer implementation with selection support
}
```

## New Unified Interface
```typescript
interface LayerOptions {
  // Base required options
  formData: QueryFormData;
  payload: JsonObject;
  onAddFilter: HandlerFunction;
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
  
  // Optional features
  datasource?: Datasource;                // For Scatter layer
  geoJson?: JsonObject;                   // For Country and Feed layers
  temporalOptions?: {                     // For Country layer
    currentTime?: Date;
    allData?: JsonObject[];
  };
  viewState?: Viewport;                   // For Country layer
  selectionOptions?: {                    // For Polygon and Feed layers
    selected?: JsonObject[];
    onSelect?: (value: JsonValue) => void;
    setSelectedRegion?: (region: SelectedRegion | null) => void;
    selectedRegion?: SelectedRegion | null;
  };
}
``` 