# Multi Chart Export/Import Implementation

## Overview
This document describes the implementation of enhanced export/import functionality for the deck.gl Multi layer chart (`deck_multi`) in Apache Superset. The Multi chart is a special visualization that combines multiple deck.gl layers, and requires special handling during export/import to maintain references to its constituent charts.

## Problem Statement
The original export/import functionality did not properly handle:
1. References to other deck.gl charts (`deck_slices` parameter)
2. Dependencies between Multi charts and their constituent deck.gl charts
3. Proper ordering during import to ensure referenced charts exist before Multi charts

## Solution Architecture

### Export Enhancements

#### 1. Multi Chart Export Handler (`superset/commands/chart/exporters/multi_chart_handler.py`)
- Detects Multi charts based on `viz_type == "deck_multi"`
- Extracts `deck_slices` IDs from chart parameters
- Exports all referenced deck.gl charts along with the Multi chart
- Creates a manifest file documenting relationships
- Converts deck_slices IDs to UUIDs for better portability

#### 2. Updated Export Command (`superset/commands/chart/export.py`)
- Modified `_export()` method to use `MultiChartExportHandler` for Multi charts
- Modified `_file_content()` to convert deck_slices IDs to UUIDs during export
- Ensures all dependencies are included in the export package

### Import Enhancements

#### 1. Multi Chart Import Utils (`superset/commands/chart/importers/v1/multi_chart_utils.py`)
- Validates Multi chart dependencies before import
- Determines correct import order (regular charts before Multi charts)
- Updates deck_slices references from UUIDs to new IDs after import
- Provides utilities for finding and managing Multi chart dependencies

#### 2. Updated Import Command (`superset/commands/chart/importers/v1/__init__.py`)
- Modified `_import()` method to handle Multi charts specially
- Tracks UUID-to-ID mapping during import
- Updates Multi chart deck_slices after all charts are imported
- Ensures proper import ordering

#### 3. Import Validation (`superset/commands/chart/importers/v1/utils.py`)
- Added `validate_multi_chart_dependencies()` function
- Validates that all referenced deck.gl charts exist before importing a Multi chart
- Provides clear error messages for missing dependencies

## Key Features

### 1. Dependency Resolution
- Automatically includes all deck.gl charts referenced by a Multi chart
- Tracks missing dependencies and includes them in the manifest

### 2. UUID-Based References
- Converts deck_slices from IDs to UUIDs during export
- Maps UUIDs back to new IDs during import
- Ensures references remain valid across different Superset instances

### 3. Import Ordering
- Ensures databases are imported first
- Then datasets
- Then regular deck.gl charts
- Finally Multi charts (after their dependencies)

### 4. Manifest File
- Creates `multi_chart_manifest.yaml` documenting:
  - Multi chart metadata
  - All referenced deck.gl charts
  - Any missing dependencies

## Usage

### Exporting a Multi Chart
```python
# The standard export API automatically handles Multi charts
# GET /api/v1/chart/export/?q={"id":123}
# This will export the Multi chart and all its dependencies
```

### Importing a Multi Chart
```python
# The standard import API handles Multi charts
# POST /api/v1/chart/import/
# Upload the ZIP file containing the Multi chart and its dependencies
```

## Error Handling

### Export Errors
- Missing deck.gl charts are logged but don't fail the export
- Manifest includes list of missing dependencies

### Import Errors
- Clear error messages for missing dependencies
- Validation before import to prevent partial imports
- Proper rollback on failure

## Testing Recommendations

1. **Basic Export/Import**
   - Create a Multi chart with 3 deck.gl layers
   - Export the Multi chart
   - Import to a new database
   - Verify all layers work correctly

2. **Missing Dependencies**
   - Create a Multi chart
   - Delete one referenced deck.gl chart
   - Export and verify manifest shows missing chart
   - Import and verify appropriate error message

3. **Complex Dependencies**
   - Create multiple Multi charts sharing deck.gl layers
   - Export all Multi charts
   - Import to new instance
   - Verify all references are correctly updated

## Future Enhancements

1. **Circular Reference Detection**
   - Add validation to prevent Multi charts from referencing other Multi charts

2. **Partial Import Support**
   - Allow importing Multi charts with missing dependencies (with warnings)

3. **UI Enhancements**
   - Show dependency tree in export preview
   - Allow selective export of dependencies
   - Import conflict resolution UI

## Migration Considerations

- The implementation is backward compatible
- Old exports (with ID-based deck_slices) will still work
- New exports use UUID-based references for better portability