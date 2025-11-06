'use client';
import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DroppableProvided,
  DraggableProvided,
  DroppableStateSnapshot,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd';
import { isEqual } from 'lodash';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SupersetClient,
  usePrevious,
  styled,
  getNumberFormatter,
  getSequentialSchemeRegistry,
  getCategoricalSchemeRegistry,
  t,
} from '@superset-ui/core';
import { Layer } from '@deck.gl/core';
import { DatePicker } from 'antd';
import Icons from 'src/components/Icons';
import { TextLayer, IconLayer } from '@deck.gl/layers';
import moment, { Moment } from 'moment';
import locale from 'antd/es/date-picker/locale/en_US';
import bbox from '@turf/bbox';
import * as GeoJSON from 'geojson';
import Modal from 'src/components/Modal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Matrix4 } from '@math.gl/core';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';
import { Viewport } from '../utils/fitViewport';
import { TooltipProps } from '../components/Tooltip';
import { countries } from '../layers/Country/countries';
// CountryKeys type is inferred from countries object
import {
  FeedEntry,
  FeedGeoJSON,
  FeedLayerProps as FeedLayerPropsImport,
  SelectedRegion,
  ProcessedFeedData,
  FeedFormData,
  FeedGeoJSONFeature,
} from '../types/feed';
import { FeedSidePanel } from '../layers/Feed/Feed';
import RegionInfoModal from '../components/RegionInfoModal';
// Configure moment to use Monday as first day of week
moment.updateLocale('en', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4, // The week that contains Jan 4th is the first week of the year
  },
});
// Type alias for CountryKeys
type CountryKeys = keyof typeof countries;
const geoJsonCache: { [key: string]: JsonObject } = {};
export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  onSelect: () => void;
};
const StyledTimelineSlider = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
  width: 500px;
  .date-indicator {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
    text-align: center;
  }
  .progress-bar {
    height: 4px;
    background: #f0f0f0;
    border-radius: 2px;
    margin-bottom: 12px;
    position: relative;
    overflow: hidden;
  }
  .progress-indicator {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #ffc107;
    transition: width 0.3s ease;
  }
  .timeline-navigation {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .nav-button {
    background: #f0f0f0;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;
    min-width: 32px;
    height: 32px;
    &:hover {
      background: #e0e0e0;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
  .timeline-container {
    display: flex;
    align-items: center;
    overflow-x: auto;
    gap: 4px;
    padding-bottom: 4px;
    flex: 1;
    /* Hide scrollbar for Chrome, Safari and Opera */
    &::-webkit-scrollbar {
      display: none;
    }
    /* Hide scrollbar for IE, Edge and Firefox */
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .day-label {
    flex: 0 0 auto;
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 4px 8px;
    min-width: 40px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    &:hover {
      background: #f0f0f0;
    }
    &.active {
      background: #ffc107;
      color: #000;
      font-weight: 500;
    }
  }
`;
interface DraggableItemProps {
  $isVisible: boolean;
  isDragging?: boolean;
}
const DraggableItem = styled.div<DraggableItemProps>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: grab;
  border-radius: 4px;
  background-color: white;
  transition:
    color 0.2s,
    background-color 0.2s;
  position: relative;
  /* Only apply box-shadow when not being dragged */
  box-shadow: ${({ theme, isDragging }) =>
    !isDragging && theme.gridUnit >= 4
      ? '0 5px 15px rgba(0,0,0,0.15)'
      : 'none'}; // Increased shadow for non-dragging
  &:hover,
  &[data-dragging='true'] {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }
  /* Remove transition during drag to prevent animation on drop */
  ${({ isDragging }) =>
    isDragging &&
    `
    transition: none;
    /* Stronger shadow while dragging */
    box-shadow: 0 8px 20px rgba(0,0,0,0.12); // Increased shadow for dragging
  `}
  .layer-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
  }
  .drag-handle {
    color: ${({ theme }) => theme.colors.grayscale.light1};
    margin-right: 0.5rem;
    font-size: 0.875rem;
    flex-shrink: 0;
  }
  .layer-name {
    transition: all 0.2s ease-in-out;
    color: ${({ $isVisible, theme }) =>
      $isVisible
        ? theme.colors.grayscale.dark1
        : theme.colors.grayscale.light1};
    font-size: 0.8125rem;
    font-weight: 500;
    flex-grow: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }
  .color-scale-preview {
    width: 60px;
    height: 8px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .visibility-toggle {
    cursor: pointer;
    transition: color 0.2s;
    color: ${({ $isVisible, theme }) =>
      $isVisible ? theme.colors.primary.base : theme.colors.grayscale.light1};
    flex-shrink: 0;
    &:hover {
      color: ${({ $isVisible, theme }) =>
        $isVisible ? theme.colors.primary.dark1 : theme.colors.grayscale.base};
    }
  }
  .layer-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-left: 2rem;
  }
  .opacity-control {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    cursor: default;
    padding-top: 0.25rem;
    &:active {
      cursor: default;
    }
  }
  .opacity-label {
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    flex-shrink: 0;
    min-width: 48px;
  }
  .opacity-slider {
    flex-grow: 1;
    max-width: 140px;
    /* Override ant-design slider handle styles when dragging */
    .ant-slider-handle {
      &:active {
        cursor: ew-resize !important;
      }
    }
  }
`;
const StyledLegendsContainer = styled.div<{ hasOverflow: boolean }>`
  position: absolute;
  bottom: 60px;
  left: 10px;
  display: flex;
  gap: 12px;
  max-width: 50%;
  overflow-x: auto;
  padding: 4px;
  /* Apply fade only when content overflows */
  mask-image: ${({ hasOverflow }) =>
    hasOverflow
      ? `linear-gradient(
    to right,
    black 0%,
    black calc(100% - 40px),
    transparent 100%
  )`
      : 'none'};
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
`;
const LegendsContainer: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current) {
        const { scrollWidth, clientWidth } = containerRef.current;
        setHasOverflow(scrollWidth > clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);
  return (
    <StyledLegendsContainer ref={containerRef} hasOverflow={hasOverflow}>
      {children}
    </StyledLegendsContainer>
  );
};
const LegendCard = styled.div`
  background: white;
  border-radius: 4px;
  padding: 12px;
  min-width: 150px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  .layer-name {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-title {
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    margin-bottom: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    .color-box {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .label {
      font-size: 10px;
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      white-space: nowrap;
    }
  }
`;
interface ColorLegendProps {
  colorScale: (value: any) => string;
  extent?: [number, number];
  format?: (value: number) => string;
  metricPrefix?: string;
  metricUnit?: string;
  values: (number | string)[];
  metricName?: string;
  layerName: string;
  isCategorical?: boolean;
  rangeMap?: Record<string, string>;
}
const ColorLegend: React.FC<ColorLegendProps> = ({
  colorScale,
  extent,
  format,
  metricPrefix = '',
  metricUnit = '',
  values,
  metricName = 'Values',
  layerName,
  isCategorical = false,
  rangeMap = {},
}) => {
  // Get unique values and sort them
  const uniqueValues = [...new Set(values)].sort((a, b) => {
    if (isCategorical) {
      return String(a).localeCompare(String(b));
    }
    return Number(b) - Number(a);
  });
  // If we're using range map for non-categorical data, render a different type of legend
  if (!isCategorical && Object.keys(rangeMap).length > 0) {
    return (
      <LegendCard>
        <div className="layer-name">{layerName}</div>
        <div className="legend-title">{metricName}</div>
        <div className="legend-items">
          {Object.entries(rangeMap).map(([range, color], i) => {
            const [min, max] = range.split('-').map(Number);
            const formattedMin = format ? format(min) : min;
            const formattedMax = format ? format(max) : max;
            return (
              <div key={i} className="legend-item">
                <div
                  className="color-box"
                  style={{ backgroundColor: color || '#fff' }}
                />
                <span className="label">
                  {`${metricPrefix}${formattedMin}${metricUnit} - ${metricPrefix}${formattedMax}${metricUnit}`}
                </span>
              </div>
            );
          })}
        </div>
      </LegendCard>
    );
  }
  // If we have more than 5 values and not categorical, select a subset
  let displayValues = uniqueValues;
  if (!isCategorical && uniqueValues.length > 5) {
    const min = uniqueValues[uniqueValues.length - 1];
    const max = uniqueValues[0];
    const middleIndices = [
      Math.floor(uniqueValues.length * 0.25),
      Math.floor(uniqueValues.length * 0.5),
      Math.floor(uniqueValues.length * 0.75),
    ];
    const middleValues = middleIndices.map(i => uniqueValues[i]);
    displayValues = [max, ...middleValues, min];
  }
  return (
    <LegendCard>
      <div className="layer-name">{layerName}</div>
      <div className="legend-title">{metricName}</div>
      <div className="legend-items">
        {displayValues.map((value, i) => (
          <div key={i} className="legend-item">
            <div
              className="color-box"
              style={{ backgroundColor: colorScale(value) || '#fff' }}
            />
            <span className="label">
              {isCategorical
                ? t(String(value))
                : `${metricPrefix}${format?.(value as number) || value}${metricUnit}`}
            </span>
          </div>
        ))}
      </div>
    </LegendCard>
  );
};
// Add this styled component near the other styled components
const LayersCardContent = styled.div`
  // padding: 1rem;
  max-height: 50vh;
  overflow-y: auto;
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) =>
      theme.colors.grayscale.light2}; // Re-added this line
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.grayscale.light1};
    border-radius: 3px;
    &:hover {
      background: ${({ theme }) => theme.colors.grayscale.base};
    }
  }
  // Add positioning and sizing directly here, remove the Card wrapper
  position: absolute;
  top: 10px;
  left: 10px;
  width: 300px;
  z-index: 1;
  // No background or shadow directly on LayersCardContent to make items appear floating
  // The individual DraggableItem components will retain their background and shadow
`;
// Update the layer interface to include new properties
interface ExtendedLayer extends Layer {
  colorScale?: (value: any) => string;
  extent?: [number, number];
  metricValues?: number[];
  categoricalValues?: string[];
  valueMap?: Record<string, string | number>;
}
// Add type definitions for the form data
interface MetricDefinition {
  column_name: string;
  label: string;
}
interface SubsliceFormData extends QueryFormData {
  viz_type: string;
  filters?: any[];
  temporal_column?: string;
  metrics?: (string | MetricDefinition)[];
  metric?: string | MetricDefinition;
  primary_metric?: string;
  [key: string]: any;
}
interface Subslice {
  slice_id: number;
  slice_name: string;
  form_data: SubsliceFormData;
}
// Add these helper functions before the DeckMulti component
const TIME_GRAIN_ORDER = {
  P1Y: 5, // Yearly
  P1M: 4, // Monthly
  P1W: 3, // Weekly
  P1D: 2, // Daily
  PT1H: 1, // Hourly
};
const getLargestTimeGrain = (timeGrains: string[]): string =>
  timeGrains.reduce((largest, current) => {
    const largestOrder =
      TIME_GRAIN_ORDER[largest as keyof typeof TIME_GRAIN_ORDER] || 0;
    const currentOrder =
      TIME_GRAIN_ORDER[current as keyof typeof TIME_GRAIN_ORDER] || 0;
    return currentOrder > largestOrder ? current : largest;
  }, 'P1D'); // Default to daily if no valid grains found
const getDatesInRange = (
  startDate: Date,
  endDate: Date,
  timeGrain?: string,
) => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    // Increment based on time grain
    switch (timeGrain) {
      case 'P1Y':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      case 'P1M':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'P1W':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'P1D':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'PT1H':
        currentDate.setHours(currentDate.getHours() + 1);
        break;
      default:
        // Default to daily if no time grain specified
        currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  return dates;
};
// Add loading state interface
interface GeoJsonLoadingState {
  [key: number]: {
    loading: boolean;
    error?: string;
  };
}
// Update the FeedLayerState interface
interface FeedLayerState {
  geoJson: Record<number, FeedGeoJSON>;
  selectedRegions: Record<number, SelectedRegion | null>;
  loadingState: GeoJsonLoadingState;
}
// Define TemporalOptions if not already defined
interface TemporalOptions {
  currentTime?: Date;
  allData?: JsonObject[];
}
// Define SelectionOptions if not already defined
interface SelectionOptions {
  selectedRegion: SelectedRegion | null;
  setSelectedRegion: (region: SelectedRegion | null) => void;
}
// Define a base interface for common options
interface BaseLayerOptions {
  formData: QueryFormData | FeedFormData; // Allow both types
  payload: JsonObject;
  onAddFilter: HandlerFunction;
  setTooltip: (tooltip: any) => void; // Refine tooltip type if possible
  opacity?: number;
  // REMOVED: elevation prop as it's handled dynamically by elevationScale
}
export interface LayerOptions extends BaseLayerOptions {
  // Optional features used by specific layer types
  datasource?: Datasource; // For Scatter layer
  geoJson?: FeedGeoJSON; // For Country and Feed layers (use specific type)
  temporalOptions?: TemporalOptions; // For Country layer
  viewState?: Viewport; // For Country layer (if needed by generator)
  selectionOptions?: SelectionOptions; // For Polygon and Feed layers
  // REMOVED: opacity?: number; - Already in BaseLayerOptions
  onClick?: (info: { object?: any }) => void;
  // REMOVED: elevation?: number;
}
// Specific props for FeedLayer if needed (extending LayerOptions)
export interface LocalFeedLayerProps extends LayerOptions {
  formData: FeedFormData; // Ensure formData is FeedFormData for FeedLayer
  geoJson?: FeedGeoJSON;
  selectionOptions: SelectionOptions; // Make selectionOptions required for FeedLayer
}
// Interface for chart data points
interface ChartDataPoint {
  time: number | string; // Timestamp or formatted date string
  [key: string]: number | string | number; // Metric values
}
const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const activeDateRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>();
  const [subSlicesLayers, setSubSlicesLayers] = useState<
    Record<number, Layer[]>
  >({});
  const [visibleLayers, setVisibleLayers] = useState<{
    [key: number]: boolean;
  }>({});
  // const [layerOpacities, setLayerOpacities] = useState<{ [key: number]: number }>({})
  const [layerOrder, setLayerOrder] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>();
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
  const [temporalData, setTemporalData] = useState<
    Record<number, { column: string; dates: Date[]; data: JsonObject }>
  >({});
  const [feedLayerState, setFeedLayerState] = useState<FeedLayerState>({
    geoJson: {},
    selectedRegions: {},
    loadingState: {},
  });
  const [selectedRegion, setSelectedRegion] =
    useState<FeedGeoJSONFeature | null>(null);
  const [regionChartModalVisible, setRegionChartModalVisible] =
    useState<boolean>(false);
  const [regionChartModalContent, setRegionChartModalContent] =
    useState<React.ReactNode>(null);
  const [regionChartModalTitle, setRegionChartModalTitle] =
    useState<string>('');
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  // Add GeoJSON validation function
  const isValidFeedGeoJSON = (data: any): data is FeedGeoJSON => {
    if (!data || typeof data !== 'object') return false;
    if (data.type !== 'FeatureCollection') return false;
    if (!Array.isArray(data.features)) return false;
    return data.features.every((feature: any) => {
      if (!feature || typeof feature !== 'object') return false;
      if (feature.type !== 'Feature') return false;
      if (!feature.geometry || typeof feature.geometry !== 'object')
        return false;
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type))
        return false;
      if (!feature.properties || typeof feature.properties !== 'object')
        return false;
      if (typeof feature.properties.ISO !== 'string') return true; // Change back to true if ISO is not strictly required
      return true;
    });
  };
  // Update loadGeoJson function with better error handling and loading states
  const loadGeoJson = useCallback(async (sliceId: number, country: string) => {
    // Skip if already loaded or loading
    if (
      feedLayerState.geoJson[sliceId] ||
      (feedLayerState.loadingState[sliceId]?.loading &&
        !feedLayerState.loadingState[sliceId]?.error)
    ) {
      return;
    }
    // Set loading state
    setFeedLayerState(prev => ({
      ...prev,
      loadingState: {
        ...prev.loadingState,
        [sliceId]: { loading: true },
      },
    }));
    try {
      // Type check the country key
      if (!(country in countries)) {
        throw new Error(`Invalid country key: ${country}`);
      }
      const countryKey = country as CountryKeys;
      const url = countries[countryKey];
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Validate GeoJSON structure
      if (!isValidFeedGeoJSON(data)) {
        throw new Error('Invalid GeoJSON data structure');
      }
      // Update state with validated data
      setFeedLayerState(prev => ({
        ...prev,
        geoJson: {
          ...prev.geoJson,
          [sliceId]: data,
        },
        loadingState: {
          ...prev.loadingState,
          [sliceId]: { loading: false },
        },
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load GeoJSON';
      // Update error state
      setFeedLayerState(prev => ({
        ...prev,
        loadingState: {
          ...prev.loadingState,
          [sliceId]: { loading: false, error: errorMessage },
        },
      }));
    }
  }, [feedLayerState]);
  // Function to create layer based on filtered data
  const createLayer = useCallback(
    (
      subslice: Subslice,
      json: JsonObject, // Keep the original full json payload
      filteredData: JsonObject[], // This might be data filtered by the timeline
    ) => {
      // Use the *original* unfiltered data for the click handler context
      const originalLayerData = Array.isArray(json.data?.data)
        ? json.data.data
        : Array.isArray(json.data)
        ? json.data
        : [];
      // Helper to get metric key from definition or string
      const getMetricKey = (metric: string | MetricDefinition): string =>
        typeof metric === 'object' ? metric.label || metric.column_name : metric;
      // Consolidate metrics for consistency
      const rawMetrics = subslice.form_data.metrics || (subslice.form_data.metric ? [subslice.form_data.metric] : []);
      const metricKeys = rawMetrics.map(getMetricKey);
      const modifiedPayload = { ...json };
      if (Array.isArray(modifiedPayload.data)) {
        modifiedPayload.data = filteredData;
      } else if (modifiedPayload.data && Array.isArray(modifiedPayload.data.data)) {
        modifiedPayload.data.data = filteredData;
      }
      const layerGeneratorOptions: LayerOptions = {
        // Use LayerOptions type
        formData: subslice.form_data as QueryFormData | FeedFormData,
        payload: modifiedPayload, // Use time-filtered data for rendering
        onAddFilter: props.onAddFilter,
        setTooltip,
        datasource: props.datasource,
        temporalOptions: {
          currentTime,
          allData: originalLayerData, // Pass original data here if needed by generator
        },
        opacity: 1.0, // Opacity is now fixed at 1.0
        // Define properties explicitly, even if undefined initially
        geoJson: undefined,
        selectionOptions: undefined,
        onClick: undefined,
      };
      if (subslice.form_data.viz_type === 'deck_feed') {
        // ... existing deck_feed logic ...
      } else if (subslice.form_data.viz_type === 'deck_country') {
        const country = subslice.form_data.select_country;
        // Define identifier column (needs to be configured or inferred)
        const regionIdentifierColumn =
          subslice.form_data.country_column || 'country_id';
        const temporalColumn = subslice.form_data.temporal_column;
       
        const createAndSetLayer = (geoJsonData: JsonObject) => {
          const handleClick = (info: { object?: FeedGeoJSONFeature | any }) => {
            // Use more specific type if possible
            const clickedFeature = info.object as
              | FeedGeoJSONFeature
              | undefined;
            if (!clickedFeature || !clickedFeature.properties) {
              return;
            }
            // Extract region identifier (e.g., ISO code, Admin level ID)
            const regionId =
              clickedFeature.properties.ISO ||
              clickedFeature.properties.id ||
              clickedFeature.properties.name;
            const regionName =
              clickedFeature.properties.ADM1 ||
              clickedFeature.properties.name ||
              clickedFeature.properties.NAME ||
              regionId ||
              'Selected Region'; // Get a display name
            if (!regionId) {
              setRegionChartModalTitle(`Data for ${regionName}`);
              setRegionChartModalContent(
                <div>
                  Could not identify the specific region from the click event.
                </div>,
              );
              setRegionChartModalVisible(true);
              return;
            }
            // Filter the *original* dataset for this region
            const regionData = originalLayerData.filter(
              (row: JsonObject) => row[regionIdentifierColumn] === regionId,
            );
            if (temporalColumn && regionData.length > 0) {
              // --- Check if it's a categorical layer using value_map ---
              const isCategorical =
                subslice.form_data.value_map &&
                Object.keys(subslice.form_data.value_map).length > 0 &&
                subslice.form_data.categorical_column;
              if (isCategorical) {
                // --- Categorical Data Visualization (List View) ---
                const categoricalColumn = subslice.form_data.categorical_column;
                const valueMap = subslice.form_data.value_map as Record<
                  string,
                  string
                >; // Assert type
                const categoryTimelineData = regionData
                  .map((row: any) => {
                    return {
                      time: new Date(row[temporalColumn]).getTime(),
                      category: row[categoricalColumn], // Use the correct categorical column
                    };
                  })
                  .filter(
                    (item: any) =>
                      item.category !== undefined && item.category !== null,
                  ) // Filter out null/undefined categories
                  .sort((a: any, b: any) => a.time - b.time)
                  .map((item: any) => ({
                    ...item,
                    timeFormatted: moment(item.time).format(
                      subslice.form_data.date_format || 'DD MMM YYYY',
                    ), // Format time
                  }));
                setRegionChartModalTitle(
                  `${t(subslice.slice_name)} (${regionName})`,
                );
                if (categoryTimelineData.length > 0) {
                  setRegionChartModalContent(
                    <div
                      style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                        paddingRight: '10px',
                      }}
                    >
                      <h4>
                        {subslice.form_data.categorical_column_label ||
                          categoricalColumn}{' '}
                        Over Time
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {categoryTimelineData.map((item: any, index: any) => (
                          <li
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '8px',
                              padding: '6px',
                              borderLeft: `5px solid ${valueMap[item.category] || '#ccc'}`, // Use color from value_map
                              backgroundColor: '#f9f9f9',
                              borderRadius: '3px',
                            }}
                          >
                            <span
                              style={{
                                backgroundColor:
                                  valueMap[item.category] || '#ccc',
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                marginRight: '10px',
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 500,
                                marginRight: '10px',
                                minWidth: '150px',
                              }}
                            >
                              {item.timeFormatted}:
                            </span>
                            <span>{t(item.category)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>,
                  );
                } else {
                  setRegionChartModalContent(
                    <div>
                      No valid categorical data points found for this timeline.
                    </div>,
                  );
                }
              } else {
                // 🚀 --- Numerical Data Visualization (Multi-Metric Line Chart) --- 🚀
               
                // 1. Prepare data structure
                const chartData: ChartDataPoint[] = regionData
                  .map((row: any) => {
                    const point: ChartDataPoint = {
                      time: new Date(row[temporalColumn]).getTime(),
                    };
                   
                    let hasValidMetric = false;
                   
                    // Iterate over all metric keys to build the data point
                    metricKeys.forEach(metricKey => {
                      // Check for value by metric key, falling back to 'metric' if available and key is 'metric'
                      let value = row[metricKey];
                      if (value === undefined && metricKey === 'metric' && row.metric !== undefined) {
                          value = row.metric;
                      }
                      const numValue = Number(value);
                      if (!isNaN(numValue) && numValue !== null) {
                        point[metricKey] = numValue;
                        hasValidMetric = true;
                      }
                    });
                   
                    // Only return data points that have at least one valid metric value
                    return hasValidMetric ? point : null;
                  })
                  .filter((point: ChartDataPoint | null): point is ChartDataPoint => point !== null) // Filter out nulls
                  .sort(
                    (a: any, b: any) => (a.time as number) - (b.time as number),
                  )
                  .map((point: any) => ({
                    ...point,
                    time: moment(point.time).format(
                      subslice.form_data.date_format || 'DD MMM YYYY',
                    ), // Use configured/default format for XAxis
                  }));
                // 2. Render Chart if data is present
                if (chartData.length > 0 && metricKeys.length > 0) {
                  // --- Get Color Scheme for Multiple Lines ---
                  // Use a categorical scheme for the lines to ensure differentiation
                  const colorScheme = getCategoricalSchemeRegistry().get(
                    subslice.form_data.categorical_color_scheme || 'supersetColors' // Use a default categorical scheme
                  );
                  const lineColors = colorScheme?.colors || [
                    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
                  ];
                 
                  // Construct title with all metric labels
                  const metricLabels = rawMetrics.map(metric =>
                    typeof metric === 'object' ? metric.label || metric.column_name : metric
                  );
                 
                  setRegionChartModalTitle(
                    `${metricLabels.join(', ')} (${regionName}) ${subslice.form_data.metric_unit ? `(${subslice.form_data.metric_unit})` : ''}`
                  );
                 
                  setRegionChartModalContent(
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis domain={['dataMin', 'dataMax']} />
                        <RechartsTooltip />
                        <Legend />
                        {metricKeys.map((metricKey, index) => {
                          // Get the label to display in the legend
                          const metricLabel = metricLabels[index] || metricKey;
                         
                          return (
                            <Line
                              key={metricKey}
                              type="monotone"
                              dataKey={metricKey} // Use the specific metric key as data key
                              stroke={lineColors[index % lineColors.length]} // Assign a color from the scheme
                              activeDot={{ r: 8 }}
                              name={metricLabel} // Use the human-readable label
                              strokeWidth={2}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  );
                } else {
                  // No temporal data or no metric data
                  setRegionChartModalTitle(`Trendline Data for ${regionName}`);
                  setRegionChartModalContent(
                    <div>
                      No valid temporal data points found for charting.
                    </div>,
                  );
                }
              }
            } else {
              // No temporal column or no data for the region
              setRegionChartModalTitle(`Data for ${regionName}`);
              const message =
                regionData.length === 0
                  ? `No data found for ${regionName} in this layer.`
                  : `No temporal data configured for this layer to display a chart for ${regionName}.`;
              setRegionChartModalContent(<div>{message}</div>);
            }
            setRegionChartModalVisible(true); // Show the modal
          };
          // Ensure geoJsonData is correctly typed before assigning
          layerGeneratorOptions.geoJson = geoJsonData as FeedGeoJSON;
          layerGeneratorOptions.onClick = handleClick;
          // Fix TS error by ensuring the generator is callable and casting options
          const vizType = subslice.form_data
            .viz_type as keyof typeof layerGenerators;
          if (typeof layerGenerators[vizType] === 'function') {
            // Check if the layer generator expects separate arguments or options object
            const generator = layerGenerators[vizType];
            const layers = generator(layerGeneratorOptions as any);
            setSubSlicesLayers(prevLayers => ({
              ...prevLayers,
              // Ensure the result is always an array of Layers
              [subslice.slice_id]: (Array.isArray(layers)
                ? layers
                : [layers]
              ).filter(l => l instanceof Layer) as Layer[],
            }));
          } else {
            // Invalid viz_type or layer generator not found
          }
        };
        // ... logic to fetch/use cached geoJson ...
        // Fix potential type error with country key access
        const countryKey = country as keyof typeof countries;
        if (country && typeof countries[countryKey] === 'string') {
          if (geoJsonCache[country]) {
            createAndSetLayer(geoJsonCache[country]);
          } else {
            const url = countries[countryKey];
            fetch(url)
              .then(response => {
                if (!response.ok)
                  throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
              })
              .then(data => {
                geoJsonCache[country] = data; // Cache the data
                createAndSetLayer(data);
              })
              .catch(error => {
                // Optionally set an error state for this layer
              });
          }
        } else if (country) {
          // Invalid or missing country key
        }
      } else if (
        typeof layerGenerators[
          subslice.form_data.viz_type as keyof typeof layerGenerators
        ] === 'function'
      ) {
        // Fix TS error by ensuring the generator is callable and casting options
        const vizType = subslice.form_data
          .viz_type as keyof typeof layerGenerators;
        // Check if the layer generator expects separate arguments or options object
        const generator = layerGenerators[vizType];
        const layer = generator(layerGeneratorOptions as any);
        setSubSlicesLayers(prevLayers => ({
          ...prevLayers,
          // Ensure the result is always an array of Layers
          [subslice.slice_id]: (Array.isArray(layer) ? layer : [layer]).filter(
            l => l instanceof Layer,
          ) as Layer[],
        }));
      } else {
        // Invalid viz_type or layer generator not found
      }
    },
    [
      props.onAddFilter,
      props.datasource,
      setTooltip,
      currentTime,
      temporalData,
      feedLayerState.geoJson,
      setRegionChartModalVisible,
      setRegionChartModalContent,
      setRegionChartModalTitle,
    ],
  );
  // Function to filter data based on current time
  const filterDataByTime = useCallback(
    (data: JsonObject[], temporalColumn: string, time: Date) => {
      // filtering must be in the level of granularity of time
      const filtered = data.filter(row => {
        const rowDate = new Date(row[temporalColumn]);
        return rowDate.getTime() === time.getTime();
      });
      return filtered;
    },
    [],
  );
  const loadLayer = useCallback(
    (subslice, filters) => {
      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      };
      const url = getExploreLongUrl(subsliceCopy.form_data, 'json');
      if (url) {
        SupersetClient.get({
          endpoint: url,
        })
          .then(({ json }) => {
            // Get the data array from either json.data.data or json.data
            const layerData = Array.isArray(json.data?.data)
              ? json.data.data
              : Array.isArray(json.data)
              ? json.data
              : [];
            // Store temporal data if available
            const temporalColumn = subsliceCopy.form_data.temporal_column;
            if (temporalColumn && layerData.length > 0) {
              const dates = layerData
                .map((d: JsonObject) => new Date(d[temporalColumn]))
                .filter((d: Date) => !isNaN(d.getTime()));
              if (dates.length > 0) {
                setTemporalData(prev => ({
                  ...prev,
                  [subsliceCopy.slice_id]: {
                    column: temporalColumn,
                    dates,
                    data: json,
                  },
                }));
              }
            }
            // Create initial layer with all data
            try {
              createLayer(subsliceCopy, json, layerData);
            } catch (error) {
              // Error loading layer
            }
            // Set initial layer order if needed
            setLayerOrder(prevOrder =>
              prevOrder.includes(subslice.slice_id)
                ? prevOrder
                : [...prevOrder, subslice.slice_id],
            );
          })
          .catch(error => {
            // Failed to load layer data
          });
      }
    },
    [createLayer, feedLayerState],
  );
  const loadLayers = useCallback(
    (formData: QueryFormData, payload: JsonObject, viewport?: Viewport) => {
      setViewport(viewport);
      // Initialize layerOrder with the order from deck_slices
      const initialOrder = formData.deck_slices || [];
      setLayerOrder(initialOrder);
      // Process slices in the order specified by deck_slices
      const orderedSlices = [...payload.data.slices].sort((a, b) => {
        const aIndex = initialOrder.indexOf(a.slice_id);
        const bIndex = initialOrder.indexOf(b.slice_id);
        return aIndex - bIndex;
      });
      // Set all layers to invisible initially
      const initialVisibility: { [key: number]: boolean } = {};
      // const initialOpacities: { [key: number]: number } = {}
      orderedSlices.forEach(
        (subslice: { slice_id: number } & JsonObject, index: number) => {
          // Make the first layer (index 0) visible, all others invisible
          initialVisibility[subslice.slice_id] = index === 0;
          // initialOpacities[subslice.slice_id] = 1.0
          // Load GeoJSON for Feed layers
          if (
            subslice.form_data.viz_type === 'deck_feed' &&
            subslice.form_data.select_country
          ) {
            loadGeoJson(subslice.slice_id, subslice.form_data.select_country);
          }
        },
      );
      setVisibleLayers(initialVisibility);
      // setLayerOpacities(initialOpacities)
      // Load all layers but only the visible ones will be rendered
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject) => {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(formData.filters || []),
          ...(formData.extra_filters || []),
        ];
        loadLayer(subslice, filters);
      });
    },
    [loadLayer, loadGeoJson],
  );
  const prevDeckSlices = usePrevious(props.formData.deck_slices);
  useEffect(() => {
    const { formData, payload } = props;
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices);
    if (hasChanges) {
      loadLayers(formData, payload);
    }
  }, [loadLayers, prevDeckSlices, props]);
  // Inside DeckMulti function component
  const toggleLayerVisibility = useCallback((layerId: number) => {
    // A flag to check if the layer is currently visible
    const isCurrentlyVisible = visibleLayers[layerId];
    setVisibleLayers(prev => {
      // If the clicked layer is already visible, the new state is all false (hides it)
      if (isCurrentlyVisible) {
        const newState: { [key: number]: boolean } = {};
        Object.keys(prev).forEach(id => {
          newState[Number(id)] = false;
        });
        return newState;
      }
      // If the clicked layer is hidden, the new state has ONLY this layer visible
      const newState: { [key: number]: boolean } = {};
      Object.keys(prev).forEach(id => {
        newState[Number(id)] = Number(id) === layerId;
      });
      newState[layerId] = true; // Ensure the target layer is true
      return newState;
    });
    // --- Feed Layer Selection Clearing Logic (Remains the same) ---
    // If it's a Feed layer being hidden, clear its selection
    const subslice = props.payload.data.slices.find(
      (slice: { slice_id: number }) => slice.slice_id === layerId,
    );
    if (
      subslice?.form_data.viz_type === 'deck_feed' &&
      isCurrentlyVisible // Check if it *was* visible before the toggle
    ) {
      setFeedLayerState(prev => ({
        ...prev,
        selectedRegions: {
          ...prev.selectedRegions,
          [layerId]: null,
        },
      }));
    }
    // --- Layer Reinitialization Logic (Remains the same, but now runs on any visibility change) ---
    // If the layer is now visible, reinitialize it to ensure proper data/deck.gl state
    if (!isCurrentlyVisible && subslice) {
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(props.formData.filters || []),
        ...(props.formData.extra_filters || []),
      ];
      // Use loadLayer to reinitialize the layer
      loadLayer(subslice, filters);
    }
  }, [
    visibleLayers,
    feedLayerState.selectedRegions,
    props.payload.data.slices,
    props.formData.filters,
    props.formData.extra_filters,
    loadLayer,
  ]);
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const reordered = Array.from(layerOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setLayerOrder(reordered);
    // Reinitialize the moved layer to avoid reusing a finalized layer
    const movedLayerId = parseInt(result.draggableId, 10);
    if (!visibleLayers[movedLayerId]) {
      const subslice = props.payload.data.slices.find(
        (slice: { slice_id: number }) => slice.slice_id === movedLayerId,
      );
      if (subslice) {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(props.formData.filters || []),
          ...(props.formData.extra_filters || []),
        ];
        loadLayer(subslice, filters);
      }
    }
  };
  const { payload, formData, setControlValue, height, width } = props;
  // Separate text layers from other layers and reorder them
  const orderedLayers = useMemo(() => {
    const nonTextLayers: Layer[] = [];
    const iconLayers: Layer[] = [];
    const textLayers: Layer[] = [];
    const PITCH_SCALE_FACTOR = 1000; // Adjusted for potential visibility
    const currentMapPitch = viewport?.pitch ?? 0; // Use viewport for pitch
    // Helper function to get region key from text data
    const getRegionKey = (d: any) => {
      const regionId =
        d.object?.properties?.ADM1 ||
        d.object?.properties?.name ||
        d.object?.properties?.NAME ||
        d.object?.properties?.ISO;
      return regionId;
    };
    const combinedTextData = new Map<
      string,
      { coordinates: number[]; texts: string[] }
    >();
    layerOrder
      .filter(id => visibleLayers[id])
      .forEach(id => {
        const layerGroup = subSlicesLayers[id];
        const layerType = props.payload.data.slices.find(
          (slice: any) => slice.slice_id === id,
        )?.form_data.viz_type;
        // Ensure layerGroup is an array before iterating
        if (Array.isArray(layerGroup)) {
          layerGroup.forEach(layer => {
            // Check if layer is a valid deck.gl Layer instance with a clone method
            if (layer && typeof layer.clone === 'function') {
              // if not visible, skip
              // This check is technically redundant due to the .filter(id => visibleLayers[id]) above,
              // but kept for clarity or if the filter is removed in the future.
              if (!visibleLayers[id]) {
                return;
              }
              // Calculate dynamic elevation scale based on pitch AND visible layer order index
              // Normalize pitch (0-60 degrees) to a 0-1 range, then apply factor and index
              const normalizedPitch = currentMapPitch * 2.5;
              // Filter layerOrder to get only visible layers for height calculation
              const visibleLayerIds = layerOrder.filter(
                layerId => visibleLayers[layerId],
              );
              const visibleLayerIndex = visibleLayerIds.indexOf(id); // Index within visible layers
              const countVisibleLayers = visibleLayerIds.length;
              // Base elevation increases with layer order among visible layers
              const baseElevation =
                normalizedPitch *
                PITCH_SCALE_FACTOR *
                (countVisibleLayers - visibleLayerIndex);
              // Use modelMatrix for elevation translation
              const modelMatrix = new Matrix4().translate([
                0,
                0,
                baseElevation,
              ]);
              // Clone the layer and apply the modelMatrix
              const scaledLayer = layer.clone({
                modelMatrix,
                // extruded: pitch > 1 ? true : false,
                // getElevation: (d: any) => d.properties.metric && pitch > 1 ? d.properties.metric / maxValue * 10000 : pitch > 1 ? 2000 : 0
              });
              if (layer instanceof TextLayer) {
                // Handle TextLayer combining logic (no scaling needed here)
                if (layerType === 'deck_country') {
                  const data = layer.props.data || [];
                  if (Array.isArray(data)) {
                    data.forEach((d: any) => {
                      const regionKey = getRegionKey(d);
                      if (regionKey) {
                        if (!combinedTextData.has(regionKey)) {
                          combinedTextData.set(regionKey, {
                            coordinates: d.coordinates || d.position, // Use position if coordinates missing
                            texts: [],
                          });
                        }
                        const currentData = combinedTextData.get(regionKey);
                        if (currentData && d.text) {
                          // Ensure text exists
                          currentData.texts.push(d.text);
                        }
                      }
                    });
                  }
                } else {
                  textLayers.push(layer); // Push original text layer if not 'deck_country'
                }
              } else if (layer instanceof IconLayer) {
                // Apply scaling only if IconLayer should be elevated
                iconLayers.push(scaledLayer);
              } else {
                nonTextLayers.push(scaledLayer);
              }
            } else {
              // Optionally push the original layer if it shouldn't be scaled or is invalid
              if (layer instanceof TextLayer) textLayers.push(layer);
              else if (layer instanceof IconLayer) iconLayers.push(layer);
              else if (layer) nonTextLayers.push(layer); // Push original if it exists but isn't cloneable?
            }
          });
        } else if (
          layerGroup &&
          typeof (layerGroup as any).clone === 'function'
        ) {
          // Handle single layer case (less common) - Ensure it's cloneable
          const normalizedPitch = currentMapPitch / 60;
          // Filter layerOrder to get only visible layers for height calculation
          const visibleLayerIds = layerOrder.filter(
            layerId => visibleLayers[layerId],
          );
          const visibleLayerIndex = visibleLayerIds.indexOf(id); // Index within visible layers
          // const countVisibleLayers = visibleLayerIds.length; // Not strictly needed here if we assume single visible layer or specific handling
          // For a single layer, or if we want a consistent elevation when it's the only one visible
          // We might use a fixed factor or (countVisibleLayers - visibleLayerIndex) which would be (1-0) = 1
          const baseElevation =
            normalizedPitch *
            PITCH_SCALE_FACTOR *
            (visibleLayerIds.length > 0 && visibleLayerIndex !== -1
              ? visibleLayerIds.length - visibleLayerIndex
              : 1);
          const modelMatrix = new Matrix4().translate([0, 0, baseElevation]);
          const scaledLayer = (layerGroup as any).clone({ modelMatrix });
          nonTextLayers.push(scaledLayer); // Assume it's a non-text layer if single
        } else if (layerGroup) {
          // Push original if it exists but isn't cloneable?
          nonTextLayers.push(layerGroup);
        }
      });
    // Create a single text layer for deck_country text layers if show_text_labels is enabled
    if (combinedTextData.size > 0 && formData.show_text_labels) {
      const combinedData = Array.from(combinedTextData.values()).map(
        ({ coordinates, texts }) => ({
          coordinates,
          text: texts.join('\n'),
        }),
      );
      // Check if coordinates exist before creating layer
      const validCombinedData = combinedData.filter(d => d.coordinates);
      if (validCombinedData.length > 0) {
        const combinedTextLayer = new TextLayer({
          id: 'combined-country-text-layer',
          data: validCombinedData, // Use filtered data
          getPosition: (d: any) => d.coordinates,
          getText: (d: any) => d.text,
          getSize: 12,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          background: true,
          backgroundPadding: [4, 4],
          getBackgroundColor: [255, 255, 255, 230],
          fontFamily: 'Arial',
          characterSet: 'auto',
          sizeScale: 1,
          sizeUnits: 'pixels',
          sizeMinPixels: 12,
          sizeMaxPixels: 12,
          pickable: true,
          billboard: true,
          lineHeight: 1.2,
        });
        textLayers.push(combinedTextLayer);
      }
    }
    const finalLayers = [
      ...nonTextLayers.reverse(),
      ...iconLayers.reverse(),
      ...textLayers,
    ];
    // Return layers in correct order: base layers, icon layers, and text layer on top
    return finalLayers;
  }, [
    layerOrder,
    visibleLayers,
    subSlicesLayers,
    formData.show_text_labels,
    props.payload.data.slices,
    viewport, // ADDED viewport as dependency for pitch changes
  ]);
  // Effect to update layers when time changes
  useEffect(() => {
    if (currentTime && Object.keys(temporalData).length > 0) {
      Object.entries(temporalData).forEach(([sliceId, { column, data }]) => {
        const numericSliceId = Number(sliceId);
        // Check visibility *before* filtering and recreating
        if (visibleLayers[numericSliceId]) {
          const subslice = props.payload.data.slices.find(
            (slice: any) => slice.slice_id === numericSliceId,
          );
          if (subslice) {
            // Get the *original* full data associated with this slice ID
            const originalJsonPayload = temporalData[numericSliceId]?.data;
            if (!originalJsonPayload) {
              return;
            }
            const originalLayerData = Array.isArray(
              originalJsonPayload.data?.data,
            )
              ? originalJsonPayload.data.data
              : Array.isArray(originalJsonPayload.data)
              ? originalJsonPayload.data
              : [];
            // Filter data for the current time step for rendering
            const filteredDataForTime = filterDataByTime(
              originalLayerData,
              column,
              currentTime,
            );
            // Recreate layer with the time-filtered data, but pass the original payload too
            createLayer(subslice, originalJsonPayload, filteredDataForTime);
          }
        }
      });
    }
    // Add createLayer and filterDataByTime to dependencies if not already present
  }, [
    currentTime,
    temporalData,
    visibleLayers,
    filterDataByTime,
    createLayer,
    props.payload.data.slices,
  ]);
  // Effect to update time range when temporal data changes
  useEffect(() => {
    if (Object.keys(temporalData).length > 0) {
      const allDates = Object.values(temporalData).flatMap(
        ({ dates }) => dates,
      );
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        setTimeRange([minDate, maxDate]);
        if (!currentTime) {
          // Find the nearest date to current system time
          const currentSystemTime = new Date().getTime();
          const nearestDate = allDates.reduce((prev, curr) =>
            Math.abs(curr.getTime() - currentSystemTime) <
            Math.abs(prev.getTime() - currentSystemTime)
              ? curr
              : prev,
          );
          // Set the nearest date as current time, but ensure it's within the time range
          const boundedTime = new Date(
            Math.min(
              Math.max(nearestDate.getTime(), minDate.getTime()),
              maxDate.getTime(),
            ),
          );
          setCurrentTime(boundedTime);
        }
      }
    }
  }, [temporalData, currentTime]);
  const clearFeedLayerSelection = useCallback((sliceId: number) => {
    setFeedLayerState(prev => ({
      ...prev,
      selectedRegions: {
        ...prev.selectedRegions,
        [sliceId]: null,
      },
    }));
  }, []);
  // Add cleanup effect
  useEffect(
    () => () => {
      // Clear any pending tooltips and selections on unmount
      setTooltip?.(null);
      Object.keys(feedLayerState.selectedRegions).forEach(id => {
        clearFeedLayerSelection(Number(id));
      });
    },
    [clearFeedLayerSelection, setTooltip],
  );
  // Add handleTimeNavigation function
  const handleTimeNavigation = useCallback(
    (direction: 'prev' | 'next') => {
      if (!timeRange || !currentTime) return;
      const timeGrains = Object.values(temporalData)
        .map(({ column }) => {
          const sliceFormData = props.payload.data.slices.find(
            (s: any) => s.form_data.temporal_column === column,
          )?.form_data;
          return sliceFormData?.time_grain_sqla;
        })
        .filter(Boolean) as string[];
      const largestTimeGrain = getLargestTimeGrain(timeGrains);
      const availableDates = getDatesInRange(
        timeRange[0],
        timeRange[1],
        largestTimeGrain,
      );
      const currentIndex = availableDates.findIndex(
        date => date.getTime() === currentTime.getTime(),
      );
      if (currentIndex === -1) return;
      const newIndex =
        direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < availableDates.length) {
        setCurrentTime(availableDates[newIndex]);
      }
    },
    [timeRange, currentTime, temporalData, props.payload.data.slices],
  );
  // Add scroll effect when currentTime changes
  useEffect(() => {
    if (currentTime && timelineContainerRef.current && activeDateRef.current) {
      const container = timelineContainerRef.current;
      const activeElement = activeDateRef.current;
      // Calculate if the active element is outside the visible area
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      if (
        activeRect.left < containerRect.left ||
        activeRect.right > containerRect.right
      ) {
        // Scroll the active element into view with smooth behavior
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentTime]);
  const getLayerName = (sliceName: string) => {
    switch (sliceName) {
      case 'Max Temperature Forecast':
        return t('Max Temperature Forecast');
      case 'Min Temperature Forecast':
        return t('Min Temperature Forecast');
      case 'Wind Speed Forecast':
        return t('Wind Speed Forecast');
      case 'Relative Humidity Forecast':
        return t('Relative Humidity Forecast');
      case 'Rainfall Forecast':
        return t('Rainfall Forecast');
      case "This Week's Dengue Cases Forecast":
        return t("This Week's Dengue Cases Forecast");
      case "This Week's Diarrhea Cases Forecast":
        return t("This Week's Diarrhea Cases Forecast");
      case 'Weather data provided by ECMWF':
        return t('Weather data provided by ECMWF');
      case 'Last successful weather update:':
        return t('Last successful weather update:');
      case 'Heat Index Forecast':
        return t('Heat Index Forecast');
      default:
        return sliceName;
    }
  };
  // Add the new Modal to the render function
  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport || props.viewport}
      layers={orderedLayers}
      mapStyle={formData.mapbox_style}
      setControlValue={(control, value) => {
        props.setControlValue(control, value);
        // No longer setting local pitch state here
      }}
      onViewportChange={setViewport}
      height={height}
      width={width}
    >
      {(() => {
        const activeFeedPanels = Object.entries(
          feedLayerState.selectedRegions,
        ).filter(
          ([sliceId, region]) => region && visibleLayers[Number(sliceId)],
        );
        return activeFeedPanels.map(([sliceId, region]) => {
          const slice = props.payload.data.slices.find(
            (s: any) => s.slice_id === Number(sliceId),
          );
          const temporalColumn = slice?.form_data.temporal_column;
          const granularity = slice?.form_data.time_grain_sqla;
          return (
            <FeedSidePanel
              key={sliceId}
              entries={region?.entries || []}
              onClose={() => clearFeedLayerSelection(Number(sliceId))}
              regionName={region?.name || 'Unknown Region'}
              temporal_column={temporalColumn}
              granularity={granularity}
              formData={slice?.form_data || {}}
            />
          );
        });
      })()}
      {timeRange && Object.keys(temporalData).length > 0 && (
        <StyledTimelineSlider>
          <div className="date-indicator">
            <DatePicker
              value={currentTime ? moment(currentTime) : undefined}
              onChange={(date: Moment | null) => {
                if (date) {
                  const selectedTime = date.toDate();
                  const boundedTime = new Date(
                    Math.min(
                      Math.max(selectedTime.getTime(), timeRange[0].getTime()),
                      timeRange[1].getTime(),
                    ),
                  );
                  setCurrentTime(boundedTime);
                }
              }}
              showTime={(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column,
                    )?.form_data;
                    return sliceFormData?.time_grain_sqla;
                  })
                  .filter(Boolean) as string[];
                const largestTimeGrain = getLargestTimeGrain(timeGrains);
                return largestTimeGrain === 'PT1H';
              })()}
              picker={(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column,
                    )?.form_data;
                    return sliceFormData?.time_grain_sqla;
                  })
                  .filter(Boolean) as string[];
                const largestTimeGrain = getLargestTimeGrain(timeGrains);
                switch (largestTimeGrain) {
                  case 'P1Y':
                    return 'year';
                  case 'P1M':
                    return 'month';
                  case 'P1W':
                    return 'week';
                  default:
                    return undefined;
                }
              })()}
              format={(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column,
                    )?.form_data;
                    return sliceFormData?.time_grain_sqla;
                  })
                  .filter(Boolean) as string[];
                const largestTimeGrain = getLargestTimeGrain(timeGrains);
                switch (largestTimeGrain) {
                  case 'P1Y':
                    return 'YYYY';
                  case 'P1M':
                    return 'MMM YYYY';
                  case 'P1W':
                    return 'MMM YYYY [Week] w';
                  case 'PT1H':
                    return 'DD MMM YYYY HH:mm';
                  default:
                    return 'DD MMM YYYY';
                }
              })()}
              allowClear={false}
              disabledDate={current => {
                if (!timeRange) return false;
                const currentDate = current?.toDate();
                return currentDate
                  ? currentDate < timeRange[0] || currentDate > timeRange[1]
                  : false;
              }}
              style={{ border: 'none', width: 'auto' }}
              locale={locale}
              onPanelChange={(value, mode) => {
                if (mode === 'week' && value) {
                  const monday = value.clone().startOf('isoWeek');
                  if (!value.isSame(monday, 'day')) {
                    setCurrentTime(monday.toDate());
                  }
                }
              }}
            />
          </div>
          <div className="progress-bar">
            <div
              className="progress-indicator"
              style={{
                width: `${
                  (((currentTime?.getTime() ?? timeRange[0].getTime()) -
                    timeRange[0].getTime()) /
                    (timeRange[1].getTime() - timeRange[0].getTime())) *
                  100
                }%`,
              }}
            />
          </div>
          <div className="timeline-navigation">
            <button
              className="nav-button"
              onClick={() => handleTimeNavigation('prev')}
              disabled={
                !currentTime || currentTime.getTime() === timeRange[0].getTime()
              }
            >
              ←
            </button>
            <div className="timeline-container" ref={timelineContainerRef}>
              {(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column,
                    )?.form_data;
                    return sliceFormData?.time_grain_sqla;
                  })
                  .filter(Boolean) as string[];
                const largestTimeGrain = getLargestTimeGrain(timeGrains);
                return getDatesInRange(
                  timeRange[0],
                  timeRange[1],
                  largestTimeGrain,
                ).map((date, index) => {
                  let dateFormat: Intl.DateTimeFormatOptions = {};
                  switch (largestTimeGrain) {
                    case 'P1Y':
                      dateFormat = { year: 'numeric' };
                      break;
                    case 'P1M':
                      dateFormat = { month: 'short', year: 'numeric' };
                      break;
                    case 'P1W':
                      dateFormat = { month: 'short', day: 'numeric' };
                      break;
                    case 'PT1H':
                      dateFormat = { hour: 'numeric', hour12: true };
                      break;
                    default:
                      dateFormat = { weekday: 'short' };
                  }
                  const isActive =
                    currentTime &&
                    date.toDateString() === currentTime.toDateString();
                  return (
                    <div
                      key={index}
                      className={`day-label ${isActive ? 'active' : ''}`}
                      onClick={() => setCurrentTime(date)}
                      ref={isActive ? activeDateRef : null}
                    >
                      {date.toLocaleDateString('en-US', dateFormat)}
                    </div>
                  );
                });
              })()}
            </div>
            <button
              className="nav-button"
              onClick={() => handleTimeNavigation('next')}
              disabled={
                !currentTime || currentTime.getTime() === timeRange[1].getTime()
              }
            >
              →
            </button>
          </div>
        </StyledTimelineSlider>
      )}
      <LayersCardContent>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable">
            {(
              provided: DroppableProvided,
              snapshot: DroppableStateSnapshot,
            ) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {layerOrder.map((id, index) => {
                  const subslice = props.payload.data.slices.find(
                    (slice: { slice_id: number }) => slice.slice_id === id,
                  );
                  const layer = subSlicesLayers[id]?.[0] as ExtendedLayer;
                  const isVisible = visibleLayers[id];
                  const loadingState = feedLayerState.loadingState[id];
                  return (
                    <Draggable key={id} draggableId={String(id)} index={index}>
                      {(
                        provided: DraggableProvided,
                        draggableSnapshot: DraggableStateSnapshot,
                      ) => (
                        <DraggableItem
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          $isVisible={isVisible}
                          isDragging={draggableSnapshot.isDragging}
                          data-dragging={draggableSnapshot.isDragging}
                        >
                          <div
                            className="layer-header"
                            {...provided.dragHandleProps}
                          >
                            <span className="drag-handle">☰</span>
                            <span className="layer-name">
                              {subslice?.slice_name &&
                                getLayerName(subslice.slice_name)}
                              {loadingState?.loading && t(' (Loading...)')}
                              {loadingState?.error && t(' (Load Failed)')}
                            </span>
                            <div className="header-controls">
                              {layer && (
                                <div
                                  className="color-scale-preview"
                                  style={{
                                    background:
                                      isVisible &&
                                      (layer as ExtendedLayer).colorScale
                                        ? subslice?.form_data.categorical_column
                                          ? `linear-gradient(to right, ${(layer as ExtendedLayer).colorScale?.((layer as ExtendedLayer).categoricalValues?.[0])}, ${(layer as ExtendedLayer).colorScale?.((layer as ExtendedLayer).categoricalValues?.[Math.min(1, ((layer as ExtendedLayer).categoricalValues?.length || 1) - 1)])}, ${(layer as ExtendedLayer).colorScale?.((layer as ExtendedLayer).categoricalValues?.[Math.min(2, ((layer as ExtendedLayer).categoricalValues?.length || 1) - 1)])})`
                                          : (layer as ExtendedLayer).extent
                                            ? `linear-gradient(to right, ${(layer as ExtendedLayer).colorScale!((layer as ExtendedLayer).extent![0])}, ${(layer as ExtendedLayer).colorScale!((layer as ExtendedLayer).extent![1])})`
                                            : '#e5e7eb'
                                        : '#e5e7eb',
                                    border: '1px solid #e5e7eb',
                                  }}
                                />
                              )}
                              <span
                                className="visibility-toggle"
                                onClick={e => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleLayerVisibility(id);
                                }}
                              >
                                {isVisible ? (
                                  <Icons.Eye iconSize="m" />
                                ) : (
                                  <Icons.EyeSlash iconSize="m" />
                                )}
                              </span>
                            </div>
                          </div>
                          {/*
                          {isVisible && (
                            <div className="layer-controls" onClick={(e) => e.stopPropagation()}>
                              <div className="opacity-control">
                                <span className="opacity-label">Opacity</span>
                                <Slider
                                  className="opacity-slider"
                                  min={0}
                                  max={100}
                                  step={1}
                                  // value={(layerOpacities[id] || 0) * 100} // Opacity state removed
                                  // onChange={(value: number) => handleOpacityChange(id, value / 100)} // Handler removed
                                  tipFormatter={value => `${value}%`}
                                />
                              </div>
                            </div>
                          )}
                          */}
                        </DraggableItem>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </LayersCardContent>
      <LegendsContainer>
        {layerOrder
          .filter(id => visibleLayers[id])
          .map(id => {
            const subslice = props.payload.data.slices.find(
              (slice: any) => slice.slice_id === id,
            );
            const layer = subSlicesLayers[id]?.[0] as ExtendedLayer;
            if (!subslice || !layer) return null;
            const { colorScale } = layer;
            const { extent } = layer;
            const metricValues = layer.metricValues || [];
            const categoricalValues = layer.categoricalValues || [];
            const isCategorical = !!subslice.form_data.categorical_column;
            if (!colorScale) return null;
            const formatter = getNumberFormatter(
              subslice.form_data.number_format || 'SMART_NUMBER',
            );
            const metricPrefix = subslice.form_data.metric_prefix
              ? `${subslice.form_data.metric_prefix} `
              : '';
            const metricUnit = subslice.form_data.metric_unit
              ? ` ${subslice.form_data.metric_unit}`
              : '';
            const metricName = isCategorical
              ? subslice.form_data.categorical_column || 'Categories'
              : (() => {
                  // Find the primary metric name for the legend title
                  const primaryMetricKey = subslice.form_data.primary_metric;
                  const rawMetrics = subslice.form_data.metrics || (subslice.form_data.metric ? [subslice.form_data.metric] : []);
                 
                  const primaryMetricDef = rawMetrics.find(m => {
                    const key = typeof m === 'object' ? m.label || m.column_name : m;
                    return key === primaryMetricKey;
                  }) || rawMetrics[0];
                  if (primaryMetricDef) {
                      return typeof primaryMetricDef === 'object'
                          ? primaryMetricDef.label || primaryMetricDef.column_name || 'Metric Range'
                          : primaryMetricDef || 'Metric Range';
                  }
                  return 'Values';
              })()
            return (
              <ColorLegend
                key={id}
                colorScale={colorScale}
                extent={extent}
                format={formatter}
                metricPrefix={metricPrefix}
                metricUnit={metricUnit}
                values={isCategorical ? categoricalValues : metricValues}
                metricName={metricName}
                layerName={t(subslice.slice_name)}
                isCategorical={isCategorical}
                rangeMap={subslice.form_data.range_map}
              />
            );
          })}
      </LegendsContainer>
      {/* Modal for Region Chart/Placeholder */}
      <Modal
        show={regionChartModalVisible}
        onHide={() => setRegionChartModalVisible(false)}
        title={regionChartModalTitle}
        // Optionally add footer buttons if needed
        footer={<></>}
        responsive // Make modal responsive
      >
        {regionChartModalContent}
      </Modal>
      {/* Existing RegionInfoModal for non-temporal clicks or other purposes if still needed */}
      {selectedRegion &&
        !regionChartModalVisible && ( // Only show if the new modal isn't active
          <RegionInfoModal
            visible={!!selectedRegion}
            onClose={() => setSelectedRegion(null)}
            properties={selectedRegion?.properties}
          />
        )}
    </DeckGLContainerStyledWrapper>
  );
};
export default memo(DeckMulti);