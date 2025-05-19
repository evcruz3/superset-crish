'use client'

import React, { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DroppableProvided, 
  DraggableProvided,
  DroppableStateSnapshot,
  DraggableStateSnapshot 
} from 'react-beautiful-dnd'
import { isEqual } from 'lodash'
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
  getSequentialSchemeRegistry, // Import the color scheme registry
} from '@superset-ui/core'
import { Layer } from '@deck.gl/core'
import { Slider, DatePicker } from 'antd'
import Icons from 'src/components/Icons'
import { TextLayer, IconLayer, GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers'
import moment from 'moment'
import { Moment } from 'moment'
import locale from 'antd/es/date-picker/locale/en_US'
import bbox from '@turf/bbox'
import * as GeoJSON from 'geojson'
import Modal from 'src/components/Modal'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { DeckGLContainerHandle, DeckGLContainerStyledWrapper } from '../DeckGLContainer'
import { getExploreLongUrl } from '../utils/explore'
import layerGenerators from '../layers'
import { Viewport } from '../utils/fitViewport'
import { TooltipProps } from '../components/Tooltip'
import { countries, type CountryKeys } from '../layers/Country/countries'
import type { CountryKeys } from '../layers/Country/countries'
import {
  FeedEntry,
  FeedGeoJSON,
  FeedLayerProps,
  SelectedRegion,
  ProcessedFeedData,
  FeedFormData,
  FeedGeoJSONFeature
} from '../types/feed'
import { FeedSidePanel } from '../layers/Feed/Feed'
import RegionInfoModal from '../components/RegionInfoModal'
import { Matrix4 } from '@math.gl/core'

// Configure moment to use Monday as first day of week
moment.updateLocale('en', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4  // The week that contains Jan 4th is the first week of the year
  }
});

// Custom Card component
const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style = {} }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', ...style }}>
    {children}
  </div>
)

const CardHeader: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
    {children}
  </div>
)

const CardTitle: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <h3 style={{ 
    fontSize: '0.875rem', 
    fontWeight: '600', 
    color: '#1f2937', 
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  }}>
    {children}
  </h3>
)

const GuideText = styled.p`
  font-size: 0.7rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
  font-style: italic;

  span {
    display: block;
    margin-bottom: 0.35rem;

    &:last-child {
      margin-bottom: 0;
    }
  }
`

// const CardContent: React.FC<React.PropsWithChildren> = ({ children }) => (
//   <div style={{ padding: '1rem' }}>
//     {children}
//   </div>
// )

// Custom Checkbox component
const Checkbox: React.FC<{
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}> = ({ id, checked, onCheckedChange }) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    style={{ height: '1rem', width: '1rem', color: '#2563eb', transition: 'all 150ms ease-in-out' }}
  />
)

// Custom Label component
const Label: React.FC<React.PropsWithChildren<{ htmlFor: string }>> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
    {children}
  </label>
)

const geoJsonCache: { [key: string]: JsonObject } = {};

export type DeckMultiProps = {
  formData: QueryFormData
  payload: JsonObject
  setControlValue: (control: string, value: JsonValue) => void
  viewport: Viewport
  onAddFilter: HandlerFunction
  height: number
  width: number
  datasource: Datasource
  onSelect: () => void
}

const StyledTimelineSlider = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
  transition: color 0.2s, background-color 0.2s;
  position: relative;
  
  /* Only apply box-shadow when not being dragged */
  box-shadow: ${({ theme, isDragging }) => 
    !isDragging && theme.gridUnit >= 4 ? '0 5px 15px rgba(0,0,0,0.15)' : 'none'}; // Increased shadow for non-dragging

  &:hover, &[data-dragging="true"] {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  /* Remove transition during drag to prevent animation on drop */
  ${({ isDragging }) => isDragging && `
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
      $isVisible ? theme.colors.grayscale.dark1 : theme.colors.grayscale.light1};
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
`

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
  mask-image: ${({ hasOverflow }) => hasOverflow ? `linear-gradient(
    to right,
    black 0%,
    black calc(100% - 40px),
    transparent 100%
  )` : 'none'};
  
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
`

const LegendsContainer: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);

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
`

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
  rangeMap?: Record<string, string>; // Add support for range map
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
  rangeMap = {} // Default to empty object
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
                ? String(value)
                : `${metricPrefix}${format?.(value as number) || value}${metricUnit}`
              }
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
    background: ${({ theme }) => theme.colors.grayscale.light2}; // Re-added this line
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
interface SubsliceFormData {
  viz_type: string;
  filters?: any[];
  temporal_column?: string;
  [key: string]: any;
}

interface Subslice {
  slice_id: number;
  slice_name: string;
  form_data: SubsliceFormData;
}

// Add these helper functions before the DeckMulti component
const TIME_GRAIN_ORDER = {
  'P1Y': 5,  // Yearly
  'P1M': 4,  // Monthly
  'P1W': 3,  // Weekly
  'P1D': 2,  // Daily
  'PT1H': 1, // Hourly
};

const getLargestTimeGrain = (timeGrains: string[]): string => {
  return timeGrains.reduce((largest, current) => {
    const largestOrder = TIME_GRAIN_ORDER[largest as keyof typeof TIME_GRAIN_ORDER] || 0;
    const currentOrder = TIME_GRAIN_ORDER[current as keyof typeof TIME_GRAIN_ORDER] || 0;
    return currentOrder > largestOrder ? current : largest;
  }, 'P1D'); // Default to daily if no valid grains found
};

const aggregateDataToTimeGrain = (
  data: JsonObject[],
  sourceColumn: string,
  sourceGrain: string,
  targetGrain: string,
  metricColumns: string[]
): JsonObject[] => {
  console.log('Aggregating data:', {
    sourceGrain,
    targetGrain,
    metricColumns,
    dataLength: data.length,
    sampleData: data.slice(0, 2),
  });

  // First convert all dates to Date objects
  const dataWithDates = data.map(row => ({
    ...row,
    __date: new Date(row[sourceColumn]),
  }));

  // Function to get the period start date based on grain
  const getPeriodStart = (date: Date, grain: string): Date => {
    const newDate = new Date(date);
    switch (grain) {
      case 'P1Y':
        return new Date(newDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      case 'P1M':
        return new Date(newDate.getFullYear(), newDate.getMonth(), 1, 0, 0, 0, 0);
      case 'P1W':
        // Get the first day of the week (Sunday)
        const dayOfWeek = newDate.getDay();
        newDate.setDate(newDate.getDate() - dayOfWeek);
        return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), 0, 0, 0, 0);
      case 'P1D':
        return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), 0, 0, 0, 0);
      case 'PT1H':
        return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), newDate.getHours(), 0, 0, 0);
      default:
        return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), 0, 0, 0, 0);
    }
  };

  // Function to get the period end date based on grain
  const getPeriodEnd = (date: Date, grain: string): Date => {
    const startDate = getPeriodStart(date, grain);
    const endDate = new Date(startDate);
    
    switch (grain) {
      case 'P1Y':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'P1M':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'P1W':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'P1D':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'PT1H':
        endDate.setHours(endDate.getHours() + 1);
        break;
      default:
        endDate.setDate(endDate.getDate() + 1);
    }
    
    // Subtract 1 millisecond to get the end of the previous period
    endDate.setMilliseconds(-1);
    return endDate;
  };

  // Function to check if a date falls within a target period
  const isWithinPeriod = (date: Date, periodStart: Date, grain: string): boolean => {
    const periodEnd = getPeriodEnd(periodStart, grain);
    return date >= periodStart && date <= periodEnd;
  };

  // Group data by country_id AND target time grain, ensuring proper period alignment
  const groupedData = new Map<string, JsonObject[]>();
  dataWithDates.forEach(row => {
    const rowDate = row.__date;
    // Get the aligned period start for the target grain
    const periodStart = getPeriodStart(rowDate, targetGrain);
    
    // Create a composite key using both country_id and aligned period
    const countryId = row.country_id || 'unknown';
    const key = `${countryId}|${periodStart.toISOString()}`;
    
    // Only include the row if it falls within the target period
    if (isWithinPeriod(rowDate, periodStart, targetGrain)) {
      // console.log('Grouping row:', {
      //   countryId,
      //   rowDate: rowDate.toISOString(),
      //   periodStart: periodStart.toISOString(),
      //   periodEnd: getPeriodEnd(periodStart, targetGrain).toISOString(),
      //   key,
      // });

      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)?.push(row);
    } else {
      console.warn('Row falls outside target period:', {
        rowDate: rowDate.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: getPeriodEnd(periodStart, targetGrain).toISOString(),
      });
    }
  });

  console.log('Grouped data stats:', {
    numberOfGroups: groupedData.size,
    sampleGroup: Array.from(groupedData.entries())[0],
    allKeys: Array.from(groupedData.keys()),
    periodBoundaries: Array.from(groupedData.keys()).map(key => {
      const [countryId, periodStr] = key.split('|');
      const periodStart = new Date(periodStr);
      return {
        countryId,
        periodStart: periodStart.toISOString(),
        periodEnd: getPeriodEnd(periodStart, targetGrain).toISOString(),
      };
    }),
  });

  // Rest of the aggregation logic remains the same
  const result = Array.from(groupedData.entries()).map(([key, rows]) => {
    const [countryId, periodKey] = key.split('|');
    const aggregated: JsonObject = {
      [sourceColumn]: periodKey,
      country_id: countryId,
    };

    metricColumns.forEach(metric => {
      const values = rows.map(row => Number(row[metric])).filter(v => !isNaN(v));
      if (values.length > 0) {
        aggregated[metric] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    Object.keys(rows[0]).forEach(key => {
      if (!metricColumns.includes(key) && 
          key !== sourceColumn && 
          key !== '__date' && 
          key !== 'country_id') {
        aggregated[key] = rows[0][key];
      }
    });

    return aggregated;
  });

  console.log('Aggregation result:', {
    resultLength: result.length,
    sampleResult: result.slice(0, 2),
    uniqueCountries: new Set(result.map(r => r.country_id)).size,
    periodSummary: result.map(r => ({
      country: r.country_id,
      period: r[sourceColumn],
      periodEnd: getPeriodEnd(new Date(r[sourceColumn]), targetGrain).toISOString(),
    })),
  });

  return result;
};

const getDatesInRange = (startDate: Date, endDate: Date, timeGrain?: string) => {
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
  selectedRegions: Record<number, SelectedRegion>;
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
    onAddFilter: (filters: any[], merge?: boolean) => void; // Refine type if possible
    setTooltip: (tooltip: any) => void; // Refine tooltip type if possible
    opacity?: number;
    // REMOVED: elevation prop as it's handled dynamically by elevationScale
}

export interface LayerOptions extends BaseLayerOptions {
    // Optional features used by specific layer types
    datasource?: Datasource;                // For Scatter layer
    geoJson?: FeedGeoJSON;                  // For Country and Feed layers (use specific type)
    temporalOptions?: TemporalOptions;      // For Country layer
    viewState?: Viewport;                   // For Country layer (if needed by generator)
    selectionOptions?: SelectionOptions;    // For Polygon and Feed layers
    // REMOVED: opacity?: number; - Already in BaseLayerOptions
    onClick?: (info: { object?: any }) => void;
    // REMOVED: elevation?: number;
}

// Specific props for FeedLayer if needed (extending LayerOptions)
export interface FeedLayerProps extends LayerOptions {
    formData: FeedFormData; // Ensure formData is FeedFormData for FeedLayer
    geoJson?: FeedGeoJSON;
    selectionOptions: SelectionOptions; // Make selectionOptions required for FeedLayer
}

// Interface for chart data points
interface ChartDataPoint {
  time: number | string; // Timestamp or formatted date string
  [key: string]: number | string; // Metric values
}

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null)
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const activeDateRef = useRef<HTMLDivElement>(null)

  const [viewport, setViewport] = useState<Viewport>()
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer[]>>({})
  const [visibleLayers, setVisibleLayers] = useState<{ [key: number]: boolean }>({})
  // const [layerOpacities, setLayerOpacities] = useState<{ [key: number]: number }>({})
  const [layerOrder, setLayerOrder] = useState<number[]>([])
  const [currentTime, setCurrentTime] = useState<Date>()
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null)
  const [temporalData, setTemporalData] = useState<Record<number, { column: string, dates: Date[], data: JsonObject }>>({})
  const [feedLayerState, setFeedLayerState] = useState<FeedLayerState>({
    geoJson: {},
    selectedRegions: {},
    loadingState: {},
  });
  const [selectedRegion, setSelectedRegion] = useState<FeedGeoJSONFeature | null>(null);
  const [regionChartModalVisible, setRegionChartModalVisible] = useState<boolean>(false);
  const [regionChartModalContent, setRegionChartModalContent] = useState<React.ReactNode>(null);
  const [regionChartModalTitle, setRegionChartModalTitle] = useState<string>('');

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef
    if (current) {
      current.setTooltip(tooltip)
    }
  }, [])

  // Add GeoJSON validation function
  const isValidFeedGeoJSON = (data: any): data is FeedGeoJSON => {
    if (!data || typeof data !== 'object') return false;
    if (data.type !== 'FeatureCollection') return false;
    if (!Array.isArray(data.features)) return false;
    
    return data.features.every(feature => {
      if (!feature || typeof feature !== 'object') return false;
      if (feature.type !== 'Feature') return false;
      if (!feature.geometry || typeof feature.geometry !== 'object') return false;
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return false;
      if (!feature.properties || typeof feature.properties !== 'object') return false;
      if (typeof feature.properties.ISO !== 'string') return false;
      
      return true;
    });
  };

  // Update loadGeoJson function with better error handling and loading states
  const loadGeoJson = useCallback(async (sliceId: number, country: string) => {
    console.log('Loading GeoJSON:', {
      sliceId,
      country,
      alreadyLoaded: !!feedLayerState.geoJson[sliceId],
      currentLoadingState: feedLayerState.loadingState[sliceId]
    });

    // Skip if already loaded or loading
    if (feedLayerState.geoJson[sliceId] || 
        (feedLayerState.loadingState[sliceId]?.loading && !feedLayerState.loadingState[sliceId]?.error)) {
      console.log('Skipping GeoJSON load - already loaded or loading');
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

      console.log('Fetching GeoJSON:', {
        sliceId,
        country,
        url
      });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate GeoJSON structure
      if (!isValidFeedGeoJSON(data)) {
        throw new Error('Invalid GeoJSON data structure');
      }

      console.log('GeoJSON loaded successfully:', {
        sliceId,
        country,
        featureCount: data.features.length
      });

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to load GeoJSON';
      console.error('GeoJSON loading error:', {
        sliceId,
        country,
        error: errorMessage
      });
      
      // Update error state
      setFeedLayerState(prev => ({
        ...prev,
        loadingState: {
          ...prev.loadingState,
          [sliceId]: { loading: false, error: errorMessage },
        },
      }));
    }
  }, []);

  const panToFeature = useCallback((feature: FeedGeoJSONFeature) => {
    
    try {
      // Cast the feature to the type expected by @turf/bbox
      const [minLng, minLat, maxLng, maxLat] = bbox(feature as unknown as GeoJSON.Feature<GeoJSON.Geometry>);
      
      // Add some padding to the bounds (10% on each side)
      const padLng = (maxLng - minLng) * 0.1;
      const padLat = (maxLat - minLat) * 0.1;
      
      // Create the new viewport with padding
      const newViewport = {
        ...viewport,
        longitude: (minLng + maxLng) / 2,
        latitude: (minLat + maxLat) / 2,
        zoom: Math.min(
          // Calculate zoom to fit the width
          Math.log2((360) / (maxLng - minLng + 2 * padLng)) + 1,
          // Calculate zoom to fit the height
          Math.log2((180) / (maxLat - minLat + 2 * padLat)) + 1
        ),
        transitionDuration: 1000,
      };

      setViewport(newViewport);
    } catch (error) {
      console.error('Error calculating feature bounds:', error);
    }
  }, [viewport, setViewport]);

  // Add retry function for failed loads
  const retryGeoJsonLoad = useCallback((sliceId: number, country: string) => {
    setFeedLayerState(prev => ({
      ...prev,
      loadingState: {
        ...prev.loadingState,
        [sliceId]: { loading: false }, // Reset error state
      },
    }));
    loadGeoJson(sliceId, country);
  }, [loadGeoJson]);

  // Function to create layer based on filtered data
  const createLayer = useCallback((
    subslice: Subslice,
    json: JsonObject, // Keep the original full json payload
    filteredData: JsonObject[], // This might be data filtered by the timeline
  ) => {
    console.log('Creating layer:', {
      sliceId: subslice.slice_id,
      vizType: subslice.form_data.viz_type,
      temporalColumn: subslice.form_data.temporal_column,
      timeGrain: subslice.form_data.time_grain_sqla,
      dataLength: filteredData.length,
      originalDataLength: json.data?.data?.length, // Log original length
    });

    // ... (rest of the aggregation logic remains the same) ...
    // Use the *original* unfiltered data for the click handler context
    const originalLayerData = Array.isArray(json.data?.data) ? json.data.data :
                             Array.isArray(json.data) ? json.data : [];


    const layerGeneratorOptions: LayerOptions = { // Use LayerOptions type
        formData: subslice.form_data,
        payload: { ...json, data: { ...json.data, data: filteredData } }, // Use time-filtered data for rendering
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
        // Let's assume it's 'country_id' for now, adjust as needed
        const regionIdentifierColumn = subslice.form_data.country_column || 'country_id';
        const temporalColumn = subslice.form_data.temporal_column;
        const metricColumns = Array.isArray(subslice.form_data.metric)
            ? subslice.form_data.metric.map((m: any) => typeof m === 'string' ? m : m.label || 'value') // Handle object metrics
            : typeof subslice.form_data.metric === 'string'
            ? [subslice.form_data.metric]
            : typeof subslice.form_data.metric === 'object' && subslice.form_data.metric !== null
            ? [subslice.form_data.metric.label || 'value'] // Handle single object metric
            : ['value']; // Default fallback

        const createAndSetLayer = (geoJsonData: JsonObject) => {
            console.log('Creating deck_country layer:', {
              sliceId: subslice.slice_id,
              temporalColumn,
              regionIdentifierColumn,
              metricColumns,
              originalDataLength: originalLayerData.length
            });

            const handleClick = (info: { object?: FeedGeoJSONFeature | any }) => { // Use more specific type if possible
              console.log('deck_country GeoJsonLayer onClick fired:', info);
              const clickedFeature = info.object as FeedGeoJSONFeature | undefined;
              if (!clickedFeature || !clickedFeature.properties) {
                  console.warn('Clicked object is not a valid GeoJSON feature with properties.');
                  return;
              }

              // Extract region identifier (e.g., ISO code, Admin level ID)
              const regionId = clickedFeature.properties.ISO || clickedFeature.properties.id || clickedFeature.properties.name;
              const regionName = clickedFeature.properties.ADM1 || clickedFeature.properties.name || clickedFeature.properties.NAME || regionId || 'Selected Region'; // Get a display name

              if (!regionId) {
                  console.warn('Could not determine region identifier from clicked feature properties:', clickedFeature.properties);
                  setRegionChartModalTitle(`Data for ${regionName}`);
                  setRegionChartModalContent(<div>Could not identify the specific region from the click event.</div>);
                  setRegionChartModalVisible(true);
                  return;
              }

              // Filter the *original* dataset for this region
              const regionData = originalLayerData.filter((row: JsonObject) =>
                  row[regionIdentifierColumn] === regionId
              );

              if (temporalColumn && regionData.length > 0) {
                  // --- Check if it's a categorical layer using value_map ---
                  const isCategorical = subslice.form_data.value_map &&
                                        Object.keys(subslice.form_data.value_map).length > 0 &&
                                        subslice.form_data.categorical_column;

                  if (isCategorical) {
                    // --- Categorical Data Visualization ---
                    console.log("[DEBUG] Handling categorical click with value_map:", subslice.form_data.value_map);
                    const categoricalColumn = subslice.form_data.temporal_column;
                    const valueMap = subslice.form_data.value_map as Record<string, string>; // Assert type

                    const categoryTimelineData = regionData
                      .map((row: any) => {
                        console.log("[DEBUG] row: ", row);
                        return {
                          time: new Date(row[temporalColumn]).getTime(),
                          category: row['categorical_value'],
                        }
                      })
                      .filter(item => item.category !== undefined && item.category !== null) // Filter out null/undefined categories
                      .sort((a, b) => a.time - b.time)
                      .map(item => ({
                        ...item,
                        timeFormatted: moment(item.time).format(subslice.form_data.date_format || 'DD MMM YYYY') // Format time
                      }));

                    setRegionChartModalTitle(`${subslice.slice_name} (${regionName})`);

                    if (categoryTimelineData.length > 0) {
                      setRegionChartModalContent(
                        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                          <h4>{subslice.form_data.categorical_column_label || categoricalColumn} Over Time</h4>
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {categoryTimelineData.map((item, index) => (
                              <li key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                                padding: '6px',
                                borderLeft: `5px solid ${valueMap[item.category] || '#ccc'}`, // Use color from value_map
                                backgroundColor: '#f9f9f9',
                                borderRadius: '3px'
                              }}>
                                <span style={{
                                  backgroundColor: valueMap[item.category] || '#ccc',
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '3px',
                                  marginRight: '10px',
                                  flexShrink: 0
                                }}></span>
                                <span style={{ fontWeight: 500, marginRight: '10px', minWidth: '150px' }}>{item.timeFormatted}:</span>
                                <span>{item.category}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    } else {
                       setRegionChartModalContent(<div>No valid categorical data points found for this timeline.</div>);
                    }

                  } else {
                    // --- Numerical Data Visualization (Existing Line Chart) ---
                    // Prepare data for line chart
                    const chartData: ChartDataPoint[] = regionData
                        .map((row: any) => {
                            const point: ChartDataPoint = {
                                time: new Date(row[temporalColumn]).getTime(),
                            };
                            metricColumns.forEach(metric => {
                                // Ensure metric value is a number
                                // Check if metric is an object like { label: 'Actual Metric Name' }
                                // const metricKey = typeof subslice.form_data.metric === 'object' && subslice.form_data.metric !== null && !Array.isArray(subslice.form_data.metric)
                                                  // ? subslice.form_data.metric.label // Use label if metric is an object
                                                  // : metric; // Otherwise use the string directly
                                const value = Number(row["metric"]); // Use the potentially adjusted key
                                point[metric] = isNaN(value) ? 0 : value; // Handle non-numeric values
                            });
                            return point;
                        })
                        .sort((a: any, b: any) => (a.time as number) - (b.time as number))
                        .map((point: any) => ({
                           ...point,
                           time: moment(point.time).format(subslice.form_data.date_format || 'DD MMM YYYY') // Use configured/default format
                        }));

                    // Basic check if data looks plottable
                    if (chartData.length > 0 && metricColumns.length > 0) {
                        // --- Get Color Scheme ---
                        const schemeName = subslice.form_data.linear_color_scheme || 'supersetColors'; // Default scheme
                        const colorScheme = getSequentialSchemeRegistry().get(schemeName);
                        const lineColors = colorScheme?.colors || ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']; // Default colors if scheme not found

                        setRegionChartModalTitle(`${subslice.slice_name} (${regionName}) (${subslice.form_data.metric_unit || ''})`);
                        setRegionChartModalContent(
                          <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis domain={['dataMin', 'dataMax']} />
                              <RechartsTooltip />
                              <Legend />
                              {metricColumns.map((metric, index) => (
                                <Line
                                  key={metric}
                                  type="monotone"
                                  dataKey={metric}
                                  // Use a consistent color, maybe the last but one from the scheme?
                                  stroke={lineColors[lineColors.length - 2] || '#1f77b4'}
                                  activeDot={{ r: 8 }}
                                  // Try to get a better name if metric is an object
                                  name={subslice.form_data.metric.column.column_name || metric}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        );
                    } else {
                       setRegionChartModalTitle(`Trendline Data for ${regionName}`);
                       setRegionChartModalContent(<div>No valid temporal data points found for charting.</div>);
                    }
                  }
              } else {
                  // No temporal column or no data for the region
                  setRegionChartModalTitle(`Data for ${regionName}`);
                  const message = regionData.length === 0
                    ? `No data found for ${regionName} in this layer.`
                    : `Placeholder: No temporal data configured for this layer to display a chart or timeline for ${regionName}.`;
                  setRegionChartModalContent(<div>{message}</div>);
              }
              setRegionChartModalVisible(true); // Show the modal
            };

            // Ensure geoJsonData is correctly typed before assigning
            layerGeneratorOptions.geoJson = geoJsonData as FeedGeoJSON;
            layerGeneratorOptions.onClick = handleClick;

            // Fix TS error by ensuring the generator is callable and casting options
            const vizType = subslice.form_data.viz_type as keyof typeof layerGenerators;
            if (typeof layerGenerators[vizType] === 'function') {
               const layers = layerGenerators[vizType](layerGeneratorOptions as any); // Use 'as any' if type matching is complex
               setSubSlicesLayers(prevLayers => ({
                 ...prevLayers,
                 // Ensure the result is always an array of Layers
                 [subslice.slice_id]: (Array.isArray(layers) ? layers : [layers]).filter(l => l instanceof Layer) as Layer[],
               }));
            } else {
               console.error(`Invalid viz_type or layer generator not found: ${vizType}`);
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
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 return response.json();
              })
              .then(data => {
                geoJsonCache[country] = data; // Cache the data
                createAndSetLayer(data);
              })
              .catch(error => {
                 console.error(`Failed to fetch GeoJSON for ${country}:`, error);
                 // Optionally set an error state for this layer
              });
          }
        } else if (country) {
             console.warn(`Invalid or missing country key: ${country}`);
        }

    } else if (typeof layerGenerators[subslice.form_data.viz_type as keyof typeof layerGenerators] === 'function') {
        // Fix TS error by ensuring the generator is callable and casting options
        const vizType = subslice.form_data.viz_type as keyof typeof layerGenerators;
        const layer = layerGenerators[vizType](layerGeneratorOptions as any); // Use 'as any' for complex types

        setSubSlicesLayers((prevLayers) => ({
          ...prevLayers,
          // Ensure the result is always an array of Layers
          [subslice.slice_id]: (Array.isArray(layer) ? layer : [layer]).filter(l => l instanceof Layer) as Layer[],
        }));
    } else {
        console.error(`Invalid viz_type or layer generator not found: ${subslice.form_data.viz_type}`);
    }

    // ... logging ...
  }, [
      props.onAddFilter,
      props.datasource,
      setTooltip,
      currentTime,
      // layerOpacities, // Opacity is no longer a dependency
      temporalData,
      feedLayerState.geoJson, // Only need geoJson here, selection handled elsewhere
      // props.payload.data.slices, // Avoid dependency if possible, use args
      // panToFeature, // Not directly used in createLayer
      // layerOrder, // Not directly used in createLayer
      // viewport, // Used for elevation calculation, keep if needed there
      // Include new modal setters if they were used inside (they are now)
      setRegionChartModalVisible,
      setRegionChartModalContent,
      setRegionChartModalTitle,
  ]);

  // Function to filter data based on current time
  const filterDataByTime = useCallback((
    data: JsonObject[],
    temporalColumn: string,
    time: Date
  ) => {
    console.log('Filtering data by time:', {
      originalDataLength: data.length,
      temporalColumn,
      filterTime: time,
    });

    // filtering must be in the level of granularity of time
    // const filtered = data.filter(row => {
    //   const rowDate = new Date(row[temporalColumn]);
    //   return rowDate <= time;
    // });
    const filtered = data.filter(row => {
      const rowDate = new Date(row[temporalColumn]);
      return rowDate.getTime() === time.getTime();
    });

    console.log('Time filtering result:', {
      filteredDataLength: filtered.length,
      sampleFilteredData: filtered.slice(0, 2),
    });

    return filtered;
  }, []);

  const loadLayer = useCallback(
    (subslice, filters) => {
      console.log('loadLayer called:', {
        sliceId: subslice.slice_id,
        vizType: subslice.form_data.viz_type,
        filters,
        hasGeoJson: subslice.form_data.viz_type === 'deck_feed' ? !!feedLayerState.geoJson[subslice.slice_id] : 'N/A'
      });

      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      }
  
      const url = getExploreLongUrl(subsliceCopy.form_data, 'json')
  
      if (url) {
        console.log('Fetching layer data:', { url });
        SupersetClient.get({
          endpoint: url,
        })
          .then(({ json }) => {
            console.log('Layer data received:', {
              sliceId: subslice.slice_id,
              dataLength: json.data?.data?.length || json.data?.length,
              hasTemporalData: !!subsliceCopy.form_data.temporal_column,
              sampleData: json.data?.data?.[0] || json.data?.[0]
            });

            // Get the data array from either json.data.data or json.data
            const layerData = Array.isArray(json.data?.data) ? json.data.data :
                            Array.isArray(json.data) ? json.data : [];

            // Store temporal data if available
            const temporalColumn = subsliceCopy.form_data.temporal_column
            if (temporalColumn && layerData.length > 0) {
              const dates = layerData
                .map((d: JsonObject) => new Date(d[temporalColumn]))
                .filter((d: Date) => !isNaN(d.getTime()))

              if (dates.length > 0) {
                setTemporalData(prev => ({
                  ...prev,
                  [subsliceCopy.slice_id]: {
                    column: temporalColumn,
                    dates,
                    data: json,
                  }
                }))
              }
            }

            // Create initial layer with all data
            try {
              console.log('Creating layer with data:', {
                sliceId: subslice.slice_id,
                vizType: subslice.form_data.viz_type,
                feedGeoJson: subslice.form_data.viz_type === 'deck_feed' ? !!feedLayerState.geoJson[subslice.slice_id] : 'N/A'
              });
              createLayer(subsliceCopy, json, layerData);
            } catch (error) {
              console.error('Error loading layer:', {
                sliceId: subslice.slice_id,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }

            // Set initial layer order if needed
            setLayerOrder((prevOrder) =>
              prevOrder.includes(subslice.slice_id)
                ? prevOrder
                : [...prevOrder, subslice.slice_id],
            );
          })
          .catch((error) => {
            console.error('Failed to load layer data:', {
              sliceId: subslice.slice_id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          });
      }
    },
    [createLayer, feedLayerState],
  )

  const loadLayers = useCallback(
    (formData: QueryFormData, payload: JsonObject, viewport?: Viewport) => {
      setViewport(viewport)
      // Initialize layerOrder with the order from deck_slices
      const initialOrder = formData.deck_slices || []
      setLayerOrder(initialOrder)
      
      // Process slices in the order specified by deck_slices
      const orderedSlices = [...payload.data.slices].sort((a, b) => {
        const aIndex = initialOrder.indexOf(a.slice_id)
        const bIndex = initialOrder.indexOf(b.slice_id)
        return aIndex - bIndex
      })
      
      // Set all layers to invisible initially
      const initialVisibility: { [key: number]: boolean } = {}
      // const initialOpacities: { [key: number]: number } = {}
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject, index: number) => {
        console.log("[DEUG] index and slice id:", index, subslice.slice_id, subslice);
        // Make the first layer (index 0) visible, all others invisible
        initialVisibility[subslice.slice_id] = index === 0
        // initialOpacities[subslice.slice_id] = 1.0
        
        // Load GeoJSON for Feed layers
        if (subslice.form_data.viz_type === 'deck_feed' && subslice.form_data.select_country) {
          loadGeoJson(subslice.slice_id, subslice.form_data.select_country);
        }
      })

      console.log("[DEBUG] initialVisibility: ", initialVisibility);
      
      setVisibleLayers(initialVisibility)
      // setLayerOpacities(initialOpacities)
      
      // Load all layers but only the visible ones will be rendered
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject) => {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(formData.filters || []),
          ...(formData.extra_filters || []),
        ]
        loadLayer(subslice, filters)
      })
    },
    [loadLayer, loadGeoJson],
  )

  const prevDeckSlices = usePrevious(props.formData.deck_slices)
  useEffect(() => {
    const { formData, payload } = props
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices)
    if (hasChanges) {
      loadLayers(formData, payload)
    }
  }, [loadLayers, prevDeckSlices, props])

  console.log("[DEBUG] visibleLayers: ", visibleLayers);

  const toggleLayerVisibility = (layerId: number) => {
    console.log('Toggling Layer Visibility:', {
      layerId,
      currentVisibility: visibleLayers[layerId],
      layerType: props.payload.data.slices.find(s => s.slice_id === layerId)?.form_data.viz_type,
      isFeedLayer: props.payload.data.slices.find(s => s.slice_id === layerId)?.form_data.viz_type === 'deck_feed'
    });
    
    setVisibleLayers(prev => {
      const newState = {
        ...prev,
        [layerId]: !prev[layerId],
      };
      console.log('New Visibility State:', newState);
      return newState;
    });
  
    // If it's a Feed layer being hidden, clear its selection
    const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === layerId);
    if (subslice?.form_data.viz_type === 'deck_feed' && visibleLayers[layerId]) {
      console.log('Clearing Feed Layer Selection:', {
        layerId,
        currentSelection: feedLayerState.selectedRegions[layerId]
      });
      setFeedLayerState(prev => ({
        ...prev,
        selectedRegions: {
          ...prev.selectedRegions,
          [layerId]: null,
        },
      }));
    }
  
    // If layer is being toggled back to visible, reinitialize it
    if (!visibleLayers[layerId] && subslice) {
      console.log('Reinitializing Layer:', {
        layerId,
        vizType: subslice.form_data.viz_type,
        hasGeoJson: subslice.form_data.viz_type === 'deck_feed' ? !!feedLayerState.geoJson[layerId] : 'N/A'
      });

      // Collect all filters
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(props.formData.filters || []),
        ...(props.formData.extra_filters || []),
      ];

      // Use loadLayer to reinitialize the layer
      loadLayer(subslice, filters);
    }
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return
    const reordered = Array.from(layerOrder)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setLayerOrder(reordered)
  
    // Reinitialize the moved layer to avoid reusing a finalized layer
    const movedLayerId = parseInt(result.draggableId, 10)
    if (!visibleLayers[movedLayerId]) {
      const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === movedLayerId)
      if (subslice) {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(props.formData.filters || []),
          ...(props.formData.extra_filters || []),
        ]
        loadLayer(subslice, filters)
      }
    }
  }

  const { payload, formData, setControlValue, height, width } = props

  // Separate text layers from other layers and reorder them
  const orderedLayers = useMemo(() => {

    const nonTextLayers: Layer[] = [];
    const iconLayers: Layer[] = [];
    const textLayers: Layer[] = [];
    const PITCH_SCALE_FACTOR = 1000; // Adjusted for potential visibility

    const currentMapPitch = viewport?.pitch ?? 0; // Use viewport for pitch

    // Helper function to get region key from text data
    const getRegionKey = (d: any) => {
        const regionId = d.object?.properties?.ADM1 ||
                        d.object?.properties?.name ||
                        d.object?.properties?.NAME ||
                        d.object?.properties?.ISO;
        return regionId;
    };
    const combinedTextData = new Map<string, { coordinates: number[], texts: string[] }>();

    layerOrder
      .filter((id) => visibleLayers[id])
      .forEach((id) => {
        const layerGroup = subSlicesLayers[id];
        const layerType = props.payload.data.slices.find(slice => slice.slice_id === id)?.form_data.viz_type;

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
                const visibleLayerIds = layerOrder.filter(layerId => visibleLayers[layerId]);
                const visibleLayerIndex = visibleLayerIds.indexOf(id); // Index within visible layers
                const countVisibleLayers = visibleLayerIds.length;

                // Base elevation increases with layer order among visible layers
                const baseElevation = normalizedPitch * PITCH_SCALE_FACTOR * (countVisibleLayers - visibleLayerIndex); 

                // Use modelMatrix for elevation translation
                const modelMatrix = new Matrix4().translate([0, 0, baseElevation]);

                // console.log('[DEBUG] Layer ID:', id, 'Index:', layerIndex, 'Pitch:', viewport?.pitch, 'Base Elevation:', baseElevation);

                // Clone the layer and apply the modelMatrix
                // Pass other necessary props if clone clears them (check deck.gl docs if needed)
                // Get maximum value from metricValues
                // const maxValue = layer.metricValues?.reduce((max: number, value: number) => Math.max(max, value), 1) ?? 1;
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
                                            texts: []
                                        });
                                    }
                                    const currentData = combinedTextData.get(regionKey);
                                    if (currentData && d.text) { // Ensure text exists
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
              console.warn('[DEBUG] Invalid layer object encountered for ID:', id, layer);
              // Optionally push the original layer if it shouldn't be scaled or is invalid
              if(layer instanceof TextLayer) textLayers.push(layer);
              else if (layer instanceof IconLayer) iconLayers.push(layer);
              else if (layer) nonTextLayers.push(layer); // Push original if it exists but isn't cloneable?
            }
          });
        } else if (layerGroup && typeof layerGroup.clone === 'function') {
          // Handle single layer case (less common) - Ensure it's cloneable
          const normalizedPitch = currentMapPitch / 60;
          
          // Filter layerOrder to get only visible layers for height calculation
          const visibleLayerIds = layerOrder.filter(layerId => visibleLayers[layerId]);
          const visibleLayerIndex = visibleLayerIds.indexOf(id); // Index within visible layers
          // const countVisibleLayers = visibleLayerIds.length; // Not strictly needed here if we assume single visible layer or specific handling

          // For a single layer, or if we want a consistent elevation when it's the only one visible
          // We might use a fixed factor or (countVisibleLayers - visibleLayerIndex) which would be (1-0) = 1
          const baseElevation = normalizedPitch * PITCH_SCALE_FACTOR * ( (visibleLayerIds.length > 0 && visibleLayerIndex !== -1) ? (visibleLayerIds.length - visibleLayerIndex) : 1);
          const modelMatrix = new Matrix4().translate([0, 0, baseElevation]);
          console.log('[DEBUG] Single Layer ID:', id, 'Index (visible):', visibleLayerIndex, 'Pitch:', viewport?.pitch, 'Base Elevation:', baseElevation);
          const scaledLayer = layerGroup.clone({ modelMatrix });
          nonTextLayers.push(scaledLayer); // Assume it's a non-text layer if single
        } else if (layerGroup) {
             console.warn('[DEBUG] Invalid single layer object encountered for ID:', id, layerGroup);
             // Push original if it exists but isn't cloneable?
             nonTextLayers.push(layerGroup);
        }
      });

    // Create a single text layer for deck_country text layers if show_text_labels is enabled
    if (combinedTextData.size > 0 && formData.show_text_labels) {
        const combinedData = Array.from(combinedTextData.values()).map(({ coordinates, texts }) => ({
            coordinates,
            text: texts.join('\n')
        }));

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

    const finalLayers = [...nonTextLayers.reverse(), ...iconLayers.reverse(), ...textLayers];

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
        const numericSliceId = Number(sliceId)
        // Check visibility *before* filtering and recreating
        if (visibleLayers[numericSliceId]) {
          const subslice = props.payload.data.slices.find(
            (slice: any) => slice.slice_id === numericSliceId
          )
          if (subslice) {
            // Get the *original* full data associated with this slice ID
            const originalJsonPayload = temporalData[numericSliceId]?.data;
            if (!originalJsonPayload) {
              console.warn(`Original JSON payload not found for slice ${numericSliceId} in temporalData`);
              return;
            }
            const originalLayerData = Array.isArray(originalJsonPayload.data?.data) ? originalJsonPayload.data.data :
                                      Array.isArray(originalJsonPayload.data) ? originalJsonPayload.data : [];

            // Filter data for the current time step for rendering
            const filteredDataForTime = filterDataByTime(originalLayerData, column, currentTime)
            // Recreate layer with the time-filtered data, but pass the original payload too
            createLayer(subslice, originalJsonPayload, filteredDataForTime)
          }
        }
      })
    }
    // Add createLayer and filterDataByTime to dependencies if not already present
  }, [currentTime, temporalData, visibleLayers, filterDataByTime, createLayer, props.payload.data.slices]);

  // Effect to update time range when temporal data changes
  useEffect(() => {
    if (Object.keys(temporalData).length > 0) {
      const allDates = Object.values(temporalData).flatMap(({ dates }) => dates)
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
        setTimeRange([minDate, maxDate])
        
        if (!currentTime) {
          // Find the nearest date to current system time
          const currentSystemTime = new Date().getTime()
          const nearestDate = allDates.reduce((prev, curr) => {
            return Math.abs(curr.getTime() - currentSystemTime) < Math.abs(prev.getTime() - currentSystemTime)
              ? curr
              : prev
          })

          // Set the nearest date as current time, but ensure it's within the time range
          const boundedTime = new Date(
            Math.min(
              Math.max(nearestDate.getTime(), minDate.getTime()),
              maxDate.getTime()
            )
          )
          setCurrentTime(boundedTime)
        }
      }
    }
  }, [temporalData, currentTime])

  // useEffect(() => {
  //   const initialVisibility: { [key: number]: boolean } = {}
  //   const initialOpacities: { [key: number]: number } = {}
  //   props.payload.data.slices.forEach((slice: any, index: number) => {
  //     // Make the first layer (index 0) visible, all others invisible
  //     initialVisibility[slice.slice_id] = index === 0
  //     initialOpacities[slice.slice_id] = 1.0
  //   })
  //   setVisibleLayers(initialVisibility)
  //   setLayerOpacities(initialOpacities)
  // }, [props.payload.data.slices])

  // Add selection state management functions
  // const handleFeedLayerSelection = useCallback((sliceId: number, region: SelectedRegion | null) => {
  //   console.log('Feed Layer Selection Handler:', {
  //     sliceId,
  //     region: region ? {
  //       name: region.name,
  //       id: region.id,
  //       entriesCount: region.entries.length
  //     } : null,
  //     currentState: {
  //       hasSelection: Boolean(feedLayerState.selectedRegions[sliceId]),
  //       isLayerVisible: visibleLayers[sliceId]
  //     }
  //   });

  //   setFeedLayerState(prev => ({
  //     ...prev,
  //     selectedRegions: {
  //       ...prev.selectedRegions,
  //       [sliceId]: region,
  //     },
  //   }));
  // }, [feedLayerState.selectedRegions, visibleLayers]);

  const clearFeedLayerSelection = useCallback((sliceId: number) => {
    console.log('Clearing Feed Layer Selection:', {
      sliceId,
      currentSelection: feedLayerState.selectedRegions[sliceId]
    });

    setFeedLayerState(prev => ({
      ...prev,
      selectedRegions: {
        ...prev.selectedRegions,
        [sliceId]: null,
      },
    }));
  }, []);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Clear any pending tooltips and selections on unmount
      setTooltip?.(null);
      Object.keys(feedLayerState.selectedRegions).forEach(id => {
        clearFeedLayerSelection(Number(id));
      });
    };
  }, [clearFeedLayerSelection, setTooltip]);

  // Add handleTimeNavigation function
  const handleTimeNavigation = useCallback((direction: 'prev' | 'next') => {
    if (!timeRange || !currentTime) return;

    const timeGrains = Object.values(temporalData)
      .map(({ column }) => {
        const sliceFormData = props.payload.data.slices.find(
          (s: any) => s.form_data.temporal_column === column
        )?.form_data;
        return sliceFormData?.time_grain_sqla;
      })
      .filter(Boolean) as string[];
    
    const largestTimeGrain = getLargestTimeGrain(timeGrains);
    const availableDates = getDatesInRange(timeRange[0], timeRange[1], largestTimeGrain);
    const currentIndex = availableDates.findIndex(
      date => date.getTime() === currentTime.getTime()
    );

    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < availableDates.length) {
      setCurrentTime(availableDates[newIndex]);
    }
  }, [timeRange, currentTime, temporalData, props.payload.data.slices]);

  // Add scroll effect when currentTime changes
  useEffect(() => {
    if (currentTime && timelineContainerRef.current && activeDateRef.current) {
      const container = timelineContainerRef.current;
      const activeElement = activeDateRef.current;
      
      // Calculate if the active element is outside the visible area
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      
      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        // Scroll the active element into view with smooth behavior
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [currentTime]);

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
        const activeFeedPanels = Object.entries(feedLayerState.selectedRegions)
          .filter(([sliceId, region]) => region && visibleLayers[Number(sliceId)]);
        
        // console.log('Feed Side Panel Render State:', {
        //   selectedRegions: Object.keys(feedLayerState.selectedRegions),
        //   visibleLayers: Object.keys(visibleLayers).filter(id => visibleLayers[Number(id)]),
        //   activePanels: activeFeedPanels.map(([sliceId, region]) => ({
        //     sliceId,
        //     regionName: region.name,
        //     entriesCount: region.entries.length,
        //     entries: region.entries
        //   }))
        // });

      
        return activeFeedPanels.map(([sliceId, region]) => {
          const temporalColumn = props.payload.data.slices.find(
            (s: any) => s.slice_id === Number(sliceId)
          )?.form_data.temporal_column;

          return (
            <FeedSidePanel
              key={sliceId}
              entries={region.entries}
              onClose={() => clearFeedLayerSelection(Number(sliceId))}
              regionName={region.name}
              temporal_column={temporalColumn}
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
                      timeRange[1].getTime()
                    )
                  );
                  setCurrentTime(boundedTime);
                }
              }}
              showTime={(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column
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
                      (s: any) => s.form_data.temporal_column === column
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
                      (s: any) => s.form_data.temporal_column === column
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
                return currentDate ? (
                  currentDate < timeRange[0] || currentDate > timeRange[1]
                ) : false;
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
                width: `${((currentTime?.getTime() ?? timeRange[0].getTime()) - timeRange[0].getTime()) / 
                  (timeRange[1].getTime() - timeRange[0].getTime()) * 100}%`
              }}
            />
          </div>
          <div className="timeline-navigation">
            <button
              className="nav-button"
              onClick={() => handleTimeNavigation('prev')}
              disabled={!currentTime || currentTime.getTime() === timeRange[0].getTime()}
            >
              ←
            </button>
            <div className="timeline-container" ref={timelineContainerRef}>
              {(() => {
                const timeGrains = Object.values(temporalData)
                  .map(({ column }) => {
                    const sliceFormData = props.payload.data.slices.find(
                      (s: any) => s.form_data.temporal_column === column
                    )?.form_data;
                    return sliceFormData?.time_grain_sqla;
                  })
                  .filter(Boolean) as string[];
                
                const largestTimeGrain = getLargestTimeGrain(timeGrains);
                
                return getDatesInRange(timeRange[0], timeRange[1], largestTimeGrain).map((date, index) => {
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
                  
                  const isActive = currentTime && date.toDateString() === currentTime.toDateString();
                  
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
              disabled={!currentTime || currentTime.getTime() === timeRange[1].getTime()}
            >
              →
            </button>
          </div>
        </StyledTimelineSlider>
      )}
      <LayersCardContent>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {layerOrder.map((id, index) => {
                  console.log("[DEBUG] id: ", id);
                  console.log("[DEBUG] index: ", index);
                  const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === id)
                  const layer = subSlicesLayers[id]?.[0] as ExtendedLayer
                  const isVisible = visibleLayers[id]
                  const loadingState = feedLayerState.loadingState[id]
                  
                  return (
                    <Draggable
                      key={id}
                      draggableId={String(id)}
                      index={index}
                    >
                      {(provided: DraggableProvided, draggableSnapshot: DraggableStateSnapshot) => (
                        <DraggableItem
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          $isVisible={isVisible}
                          isDragging={draggableSnapshot.isDragging}
                          data-dragging={draggableSnapshot.isDragging}
                        >
                          <div className="layer-header" {...provided.dragHandleProps}>
                            <span className="drag-handle">
                              ☰
                            </span>
                            <span className="layer-name">
                              {subslice?.slice_name}
                              {loadingState?.loading && ' (Loading...)'}
                              {loadingState?.error && ' (Load Failed)'}
                            </span>
                            <div className="header-controls">
                              {layer && (
                                <div 
                                  className="color-scale-preview"
                                  style={{
                                    background: isVisible && (layer as ExtendedLayer).colorScale
                                      ? subslice?.form_data.categorical_column
                                        ? `linear-gradient(to right, ${(layer as ExtendedLayer).colorScale((layer as ExtendedLayer).categoricalValues?.[0])}, ${(layer as ExtendedLayer).colorScale((layer as ExtendedLayer).categoricalValues?.[Math.min(1, ((layer as ExtendedLayer).categoricalValues?.length || 1) - 1)])}, ${(layer as ExtendedLayer).colorScale((layer as ExtendedLayer).categoricalValues?.[Math.min(2, ((layer as ExtendedLayer).categoricalValues?.length || 1) - 1)])})`
                                        : (layer as ExtendedLayer).extent
                                          ? `linear-gradient(to right, ${(layer as ExtendedLayer).colorScale!((layer as ExtendedLayer).extent![0])}, ${(layer as ExtendedLayer).colorScale!((layer as ExtendedLayer).extent![1])})`
                                          : '#e5e7eb'
                                      : '#e5e7eb',
                                    border: '1px solid #e5e7eb'
                                  }}
                                />
                              )}
                              <span 
                                className="visibility-toggle"
                                onClick={(e) => {
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
                  )
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
            const subslice = props.payload.data.slices.find(slice => slice.slice_id === id);
            const layer = subSlicesLayers[id]?.[0] as ExtendedLayer;
            
            if (!subslice || !layer) return null;

            const colorScale = layer.colorScale;
            const extent = layer.extent;
            const metricValues = layer.metricValues || [];
            const categoricalValues = layer.categoricalValues || [];
            const isCategorical = !!subslice.form_data.categorical_column;
            
            if (!colorScale) return null;

            const formatter = getNumberFormatter(subslice.form_data.number_format || 'SMART_NUMBER');
            const metricPrefix = subslice.form_data.metric_prefix ? `${subslice.form_data.metric_prefix} ` : '';
            const metricUnit = subslice.form_data.metric_unit ? ` ${subslice.form_data.metric_unit}` : '';
            const metricName = isCategorical
              ? (subslice.form_data.categorical_column || 'Categories')
              : (typeof subslice.form_data.metric === 'object' 
                ? (subslice.form_data.metric.label || subslice.form_data.metric_label || 'Values')
                : (subslice.form_data.metric || subslice.form_data.metric_label || 'Values'));

            return (
              <ColorLegend
                key={id}
                colorScale={colorScale}
                extent={extent}
                format={formatter}
                metricPrefix={metricPrefix}
                metricUnit={metricUnit}
                values={isCategorical ? categoricalValues : metricValues}
                metricName={""}
                layerName={subslice.slice_name}
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
      {selectedRegion && !regionChartModalVisible && ( // Only show if the new modal isn't active
         <RegionInfoModal
           visible={!!selectedRegion}
           onClose={() => setSelectedRegion(null)}
           properties={selectedRegion?.properties}
         />
       )}
    </DeckGLContainerStyledWrapper>
  )
}

export default memo(DeckMulti)