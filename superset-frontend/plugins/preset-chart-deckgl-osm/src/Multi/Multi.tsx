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
} from '@superset-ui/core'
import { Layer } from '@deck.gl/core'
import { Slider } from 'antd'
import Icons from 'src/components/Icons'
import { ScaleLinear } from 'd3-scale'
import { TextLayer, IconLayer } from '@deck.gl/layers'

import { DeckGLContainerHandle, DeckGLContainerStyledWrapper } from '../DeckGLContainer'
import { getExploreLongUrl } from '../utils/explore'
import layerGenerators from '../layers'
import { Viewport } from '../utils/fitViewport'
import { TooltipProps } from '../components/Tooltip'
import { countries } from '../layers/Country/countries'
import { LayerOptions } from '../types/layers'

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

  .timeline-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .day-label {
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 4px 8px;
    min-width: 40px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;

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
    !isDragging && theme.gridUnit >= 4 ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'};

  &:hover, &[data-dragging="true"] {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  /* Remove transition during drag to prevent animation on drop */
  ${({ isDragging }) => isDragging && `
    transition: none;
    /* Stronger shadow while dragging */
    box-shadow: 0 4px 8px rgba(0,0,0,0.08);
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
  bottom: 20px;
  left: 20px;
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
  isCategorical = false
}) => {
  // Get unique values and sort them
  const uniqueValues = [...new Set(values)].sort((a, b) => {
    if (isCategorical) {
      return String(a).localeCompare(String(b));
    }
    return Number(b) - Number(a);
  });
  
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
  padding: 1rem;
  max-height: 50vh;
  overflow-y: auto;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.grayscale.light1};
    border-radius: 3px;

    &:hover {
      background: ${({ theme }) => theme.colors.grayscale.base};
    }
  }
`

// Update the layer interface to include new properties
interface ExtendedLayer extends Layer {
  colorScale?: (value: any) => string;
  extent?: [number, number];
  metricValues?: number[];
  categoricalValues?: string[];
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

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null)

  const [viewport, setViewport] = useState<Viewport>()
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer[]>>({})
  const [visibleLayers, setVisibleLayers] = useState<{ [key: number]: boolean }>({})
  const [layerOpacities, setLayerOpacities] = useState<{ [key: number]: number }>({})
  const [layerOrder, setLayerOrder] = useState<number[]>([])
  const [currentTime, setCurrentTime] = useState<Date>()
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null)
  const [temporalData, setTemporalData] = useState<Record<number, { column: string, dates: Date[], data: JsonObject }>>({})

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef
    if (current) {
      current.setTooltip(tooltip)
    }
  }, [])

  // Function to create layer based on filtered data
  const createLayer = useCallback((
    subslice: Subslice,
    json: JsonObject,
    filteredData: JsonObject[],
  ) => {
    const jsonWithFilteredData = {
      ...json,
      data: {
        ...json.data,
        data: filteredData,
      },
    };

    const jsonWithAllData = {
      ...json,
      data: {
        ...json.data,
        data: json.data.data,
      },
    };

    if (subslice.form_data.viz_type === 'deck_country') {
      const country = subslice.form_data.select_country;
      
      const createAndSetLayer = (geoJsonData: JsonObject) => {
        if (typeof layerGenerators.deck_country === 'function') {
          const layers = layerGenerators.deck_country({
            formData: subslice.form_data,
            payload: jsonWithFilteredData,
            onAddFilter: props.onAddFilter,
            setTooltip,
            geoJson: geoJsonData,
            temporalOptions: {
              currentTime,
              allData: jsonWithAllData.data.data,
            },
            opacity: layerOpacities[subslice.slice_id] ?? 1.0,
          });

          setSubSlicesLayers((prevLayers) => ({
            ...prevLayers,
            [subslice.slice_id]: Array.isArray(layers) ? layers : [layers],
          }));
        }
      };

      if (country && typeof countries[country] === 'string') {
        if (geoJsonCache[country]) {
          createAndSetLayer(geoJsonCache[country]);
        } else {
          const url = countries[country];
          fetch(url)
            .then(response => response.json())
            .then(data => {
              geoJsonCache[country] = data;
              createAndSetLayer(data);
            });
        }
      }
    } else if (typeof layerGenerators[subslice.form_data.viz_type] === 'function') {
      const layer = layerGenerators[subslice.form_data.viz_type]({
        formData: subslice.form_data,
        payload: jsonWithFilteredData,
        onAddFilter: props.onAddFilter,
        setTooltip,
        datasource: props.datasource,
        temporalOptions: {
          currentTime,
          allData: jsonWithAllData.data.data,
        },
        opacity: layerOpacities[subslice.slice_id] ?? 1.0,
      });

      setSubSlicesLayers((prevLayers) => ({
        ...prevLayers,
        [subslice.slice_id]: Array.isArray(layer) ? layer : [layer],
      }));
    }
  }, [props.onAddFilter, props.datasource, setTooltip, currentTime, layerOpacities]);

  // Function to filter data based on current time
  const filterDataByTime = useCallback((
    data: JsonObject[],
    temporalColumn: string,
    time: Date
  ) => {
    return data.filter(row => {
      const rowDate = new Date(row[temporalColumn]);
      return rowDate <= time;
    });
  }, []);

  const loadLayer = useCallback(
    (subslice, filters) => {
      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      }
  
      const url = getExploreLongUrl(subsliceCopy.form_data, 'json')
  
      if (url) {
        SupersetClient.get({
          endpoint: url,
        })
          .then(({ json }) => {
            // Store temporal data if available
            const temporalColumn = subsliceCopy.form_data.temporal_column
            if (temporalColumn && json.data?.data?.length > 0) {
              const dates = json.data.data
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
            createLayer(subsliceCopy, json, json.data.data);

            // Set initial layer order if needed
            setLayerOrder((prevOrder) =>
              prevOrder.includes(subslice.slice_id)
                ? prevOrder
                : [...prevOrder, subslice.slice_id],
            );
          })
          .catch(() => {});
      }
    },
    [createLayer],
  );

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
      const initialOpacities: { [key: number]: number } = {}
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject, index: number) => {
        // Make the first layer (index 0) visible, all others invisible
        initialVisibility[subslice.slice_id] = index === 0
        initialOpacities[subslice.slice_id] = 1.0
      })
      
      setVisibleLayers(initialVisibility)
      setLayerOpacities(initialOpacities)
      
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
    [loadLayer],
  )

  const prevDeckSlices = usePrevious(props.formData.deck_slices)
  useEffect(() => {
    const { formData, payload } = props
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices)
    if (hasChanges) {
      loadLayers(formData, payload)
    }
  }, [loadLayers, prevDeckSlices, props])

  const toggleLayerVisibility = (layerId: number) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }))
  
    // If layer is being toggled back to visible, reinitialize it
    if (!visibleLayers[layerId]) {
      const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === layerId)
      if (subslice) {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(props.formData.filters || []),
          ...(props.formData.extra_filters || []),
        ]
        loadLayer(subslice, filters)
      }
    } else {
      // Remove the layer from subSlicesLayers to prevent reuse of finalized layers
      setSubSlicesLayers((prevLayers) => {
        const updatedLayers = { ...prevLayers }
        delete updatedLayers[layerId]
        return updatedLayers
      })
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

    // Helper function to get region key from text data
    const getRegionKey = (d: any) => {
      // Try different possible administrative region properties
      const regionId = d.object?.properties?.ADM1 || 
                      d.object?.properties?.name || 
                      d.object?.properties?.NAME || 
                      d.object?.properties?.ISO;
      
      // console.log('Getting region key for data:', {
      //   data: d,
      //   foundRegionId: regionId,
      //   properties: d.object?.properties,
      //   rawObject: d.object,
      //   coordinates: d.coordinates,
      //   text: d.text
      // });
      
      // if (!regionId) {
      //   console.warn('No region identifier found for data:', d);
      // }
      
      return regionId;
    };

    // First, collect all text data from all text layers
    const combinedTextData = new Map<string, { coordinates: number[], texts: string[] }>();
    
    // console.log('Processing layers:', {
    //   visibleLayerIds: layerOrder.filter(id => visibleLayers[id]),
    //   allLayers: subSlicesLayers,
    //   layerOrder,
    //   visibleLayers
    // });

    layerOrder
      .filter((id) => visibleLayers[id])
      .forEach((id) => {
        const layerGroup = subSlicesLayers[id];
        // console.log('Processing layer group:', {
        //   id,
        //   layerGroup,
        //   isArray: Array.isArray(layerGroup)
        // });

        if (Array.isArray(layerGroup)) {
          layerGroup.forEach(layer => {
            // console.log('Processing individual layer:', {
            //   layerId: layer.props.id,
            //   type: layer.constructor.name,
            //   data: layer.props.data
            // });

            if (layer instanceof TextLayer) {
              const data = layer.props.data || [];
              if (Array.isArray(data)) {
                data.forEach((d: any) => {
                  const regionKey = getRegionKey(d);
                  // console.log('Processing text data:', {
                  //   regionKey,
                  //   text: d.text,
                  //   coordinates: d.coordinates
                  // });

                  if (regionKey) {
                    if (!combinedTextData.has(regionKey)) {
                      combinedTextData.set(regionKey, {
                        coordinates: d.coordinates,
                        texts: []
                      });
                    }
                    combinedTextData.get(regionKey)?.texts.push(d.text);
                  } else {
                    console.warn('No region key found for text data:', d);
                  }
                });
              }
            } else if (layer instanceof IconLayer) {
              // console.log('Found IconLayer:', {
              //   id: layer.props.id,
              //   dataLength: layer.props.data?.length
              // });
              iconLayers.push(layer);
            } else {
              nonTextLayers.push(layer);
            }
          });
        } else if (layerGroup) {
          nonTextLayers.push(layerGroup);
        }
      });

    // console.log('Combined text data:', {
    //   regions: Array.from(combinedTextData.keys()),
    //   textsByRegion: Object.fromEntries(Array.from(combinedTextData.entries()).map(
    //     ([key, value]) => [key, value.texts]
    //   ))
    // });

    // Create a single text layer with combined texts
    if (combinedTextData.size > 0) {
      const combinedData = Array.from(combinedTextData.values()).map(({ coordinates, texts }) => ({
        coordinates,
        text: texts.join('\n')
      }));

      // console.log('Creating combined text layer with data:', combinedData);

      const combinedTextLayer = new TextLayer({
        id: 'combined-text-layer',
        data: combinedData,
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

    // Return layers in correct order: base layers, icon layers, and text layer on top
    return [...nonTextLayers.reverse(), ...iconLayers.reverse(), ...textLayers];
  }, [layerOrder, visibleLayers, subSlicesLayers]);

  // Effect to update layers when time changes
  useEffect(() => {
    if (currentTime && Object.keys(temporalData).length > 0) {
      Object.entries(temporalData).forEach(([sliceId, { column, data }]) => {
        const numericSliceId = Number(sliceId)
        if (visibleLayers[numericSliceId]) {
          const subslice = props.payload.data.slices.find(
            (slice: any) => slice.slice_id === numericSliceId
          )
          if (subslice) {
            // Filter data for current time but keep original data for color scale
            const filteredData = filterDataByTime(data.data.data, column, currentTime)
            createLayer(subslice, data, filteredData)
          }
        }
      })
    }
  }, [currentTime, temporalData, visibleLayers, filterDataByTime, createLayer, props.payload.data.slices])

  // Effect to update time range when temporal data changes
  useEffect(() => {
    if (Object.keys(temporalData).length > 0) {
      const allDates = Object.values(temporalData).flatMap(({ dates }) => dates)
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
        setTimeRange([minDate, maxDate])
        if (!currentTime) {
          setCurrentTime(minDate)
        }
      }
    }
  }, [temporalData])

  useEffect(() => {
    const initialVisibility: { [key: number]: boolean } = {}
    const initialOpacities: { [key: number]: number } = {}
    props.payload.data.slices.forEach((slice: any, index: number) => {
      // Make the first layer (index 0) visible, all others invisible
      initialVisibility[slice.slice_id] = index === 0
      initialOpacities[slice.slice_id] = 1.0
    })
    setVisibleLayers(initialVisibility)
    setLayerOpacities(initialOpacities)
  }, [props.payload.data.slices])

  const handleOpacityChange = (layerId: number, value: number) => {
    setLayerOpacities(prev => ({
      ...prev,
      [layerId]: value
    }))

    // Force layer recreation with new opacity
    const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === layerId)
    if (subslice && visibleLayers[layerId]) {
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(props.formData.filters || []),
        ...(props.formData.extra_filters || []),
      ]
      loadLayer(subslice, filters)
    }
  }

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport || props.viewport}
      layers={orderedLayers}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
      onViewportChange={setViewport}
      height={height}
      width={width}
    >
      {timeRange && Object.keys(temporalData).length > 0 && (
        <StyledTimelineSlider>
          <div className="date-indicator">
            {currentTime?.toLocaleDateString()} ({currentTime?.toLocaleDateString('en-US', { weekday: 'long' })})
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
          <div className="timeline-container">
            {['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => (
              <div 
                key={index} 
                className={`day-label ${
                  currentTime && 
                  new Date(timeRange[0].getTime() + index * 24 * 60 * 60 * 1000).toDateString() === currentTime.toDateString() 
                    ? 'active' 
                    : ''
                }`}
                onClick={() => {
                  const date = new Date(timeRange[0].getTime());
                  date.setDate(date.getDate() + index);
                  setCurrentTime(date);
                }}
              >
                {day}
              </div>
            ))}
          </div>
        </StyledTimelineSlider>
      )}
      <Card style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        width: '300px', 
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh' // This ensures the card itself doesn't exceed viewport
      }}>
        <CardHeader>
          <CardTitle>Layers</CardTitle>
          <GuideText>
            <span>• Drag layers to reorder</span>
            <span>• Toggle visibility using the eye icon</span>
            <span>• Adjust opacity using the slider</span>
          </GuideText>
        </CardHeader>
        <LayersCardContent>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="droppable">
              {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {layerOrder.map((id, index) => {
                    const subslice = props.payload.data.slices.find((slice: { slice_id: number }) => slice.slice_id === id)
                    const layer = subSlicesLayers[id]?.[0] as ExtendedLayer
                    const isVisible = visibleLayers[id]
                    
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
                              <span className="layer-name">{subslice?.slice_name}</span>
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
                            {isVisible && (
                              <div className="layer-controls" onClick={(e) => e.stopPropagation()}>
                                <div className="opacity-control">
                                  <span className="opacity-label">Opacity</span>
                                  <Slider
                                    className="opacity-slider"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={(layerOpacities[id] || 0) * 100}
                                    onChange={(value: number) => handleOpacityChange(id, value / 100)}
                                    tipFormatter={value => `${value}%`}
                                  />
                                </div>
                              </div>
                            )}
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
      </Card>
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
                metricName={metricName}
                layerName={subslice.slice_name}
                isCategorical={isCategorical}
              />
            );
          })}
      </LegendsContainer>
    </DeckGLContainerStyledWrapper>
  )
}

export default memo(DeckMulti)