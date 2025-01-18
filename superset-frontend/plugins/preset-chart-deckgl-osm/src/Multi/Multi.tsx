'use client'

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
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
import { scaleLinear, ScaleLinear } from 'd3-scale'

import { DeckGLContainerHandle, DeckGLContainerStyledWrapper } from '../DeckGLContainer'
import { getExploreLongUrl } from '../utils/explore'
import layerGenerators from '../layers'
import { Viewport } from '../utils/fitViewport'
import { TooltipProps } from '../components/Tooltip'
import countries from '../layers/Country/countries'

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

const StyledTimeSlider = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
  width: 300px;

  .time-label {
    text-align: center;
    margin-bottom: 5px;
    font-size: 12px;
  }

  .ant-slider {
    margin: 10px 0;
  }
`

interface DraggableItemProps {
  $isVisible: boolean;
  isDragging?: boolean;
}

const DraggableItem = styled.div<DraggableItemProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: grab;
  border-radius: 4px;
  background-color: white;
  transition: color 0.2s, background-color 0.2s;
  
  /* Only apply box-shadow when not being dragged */
  box-shadow: ${({ theme, isDragging }) => 
    !isDragging && theme.gridUnit >= 4 ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'};

  &:hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  /* Remove transition during drag to prevent animation on drop */
  ${({ isDragging }) => isDragging && `
    transition: none;
    /* Stronger shadow while dragging */
    box-shadow: 0 4px 8px rgba(0,0,0,0.08);
  `}

  .drag-handle {
    color: ${({ theme }) => theme.colors.grayscale.light1};
    margin-right: 0.5rem;
    font-size: 0.875rem;
  }

  .layer-name {
    transition: color 0.2s;
    color: ${({ $isVisible, theme }) => 
      $isVisible ? theme.colors.grayscale.dark1 : theme.colors.grayscale.light1};
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .visibility-toggle {
    margin-left: auto;
    cursor: pointer;
    transition: color 0.2s;
    color: ${({ $isVisible, theme }) => 
      $isVisible ? theme.colors.primary.base : theme.colors.grayscale.light1};
    font-size: 0.875rem;

    &:hover {
      color: ${({ $isVisible, theme }) => 
        $isVisible ? theme.colors.primary.dark1 : theme.colors.grayscale.base};
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
  colorScale: ScaleLinear<string, string>;
  extent: [number, number];
  format: (value: number) => string;
  metricPrefix?: string;
  metricUnit?: string;
  values: number[];
  metricName?: string;
  layerName: string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ 
  colorScale, 
  extent, 
  format, 
  metricPrefix = '', 
  metricUnit = '', 
  values,
  metricName = 'Metric Range',
  layerName
}) => {
  // Get unique values and sort them in descending order
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  
  // If we have more than 5 values, we need to select a subset
  let displayValues = uniqueValues;
  if (uniqueValues.length > 5) {
    // Always include min and max
    const min = uniqueValues[uniqueValues.length - 1];
    const max = uniqueValues[0];
    
    // For the middle values, take evenly spaced indices
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
            <span className="label">{`${metricPrefix}${format(value)}${metricUnit}`}</span>
          </div>
        ))}
      </div>
    </LegendCard>
  );
};

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null)

  const [viewport, setViewport] = useState<Viewport>()
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer>>({})
  const [visibleLayers, setVisibleLayers] = useState<Record<number, boolean>>({})
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

  console.log("payload", props.payload)

  // Function to create layer based on filtered data
  const createLayer = useCallback((
    subslice: JsonObject,
    json: JsonObject,
    filteredData: JsonObject[],
  ) => {
    const jsonWithFilteredData = {
      ...json,
      data: {
        ...json.data,
        data: filteredData,
      },
    }

    if (subslice.form_data.viz_type === 'deck_country') {
      const country = subslice.form_data.select_country;
      
      const createAndSetLayer = (geoJsonData: JsonObject) => {
        const layer = layerGenerators[subslice.form_data.viz_type](
          subslice.form_data,
          jsonWithFilteredData,
          props.onAddFilter,
          setTooltip,
          geoJsonData,
          currentTime
        );

        setSubSlicesLayers((prevLayers) => ({
          ...prevLayers,
          [subslice.slice_id]: layer,
        }));
      };

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
    } else {
      const layer = layerGenerators[subslice.form_data.viz_type](
        subslice.form_data,
        jsonWithFilteredData,
        props.onAddFilter,
        setTooltip,
        props.datasource,
        [],
        props.onSelect,
        currentTime
      );

      setSubSlicesLayers((prevLayers) => ({
        ...prevLayers,
        [subslice.slice_id]: layer,
      }));
    }
  }, [props.onAddFilter, props.onSelect, props.datasource, setTooltip, currentTime]);

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
      const initialVisibility: Record<number, boolean> = {}
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject) => {
        initialVisibility[subslice.slice_id] = false
      })
      
      // Make only the first layer visible if there are any layers
      if (orderedSlices.length > 0) {
        initialVisibility[orderedSlices[0].slice_id] = true
      }
      
      setVisibleLayers(initialVisibility)
      
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
      const subslice = props.payload.data.slices.find((slice: any) => slice.slice_id === layerId)
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
      const subslice = props.payload.data.slices.find((slice: any) => slice.slice_id === movedLayerId)
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
  const layers = layerOrder
    .filter((id) => visibleLayers[id])
    .map((id) => subSlicesLayers[id])
    .reverse()

  // Effect to update time range when temporal data changes
  useEffect(() => {
    if (Object.keys(temporalData).length > 0) {
      const allDates = Object.values(temporalData).flatMap(({ dates }) => dates)
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
        setTimeRange([minDate, maxDate])
        if (!currentTime) {
          setCurrentTime(maxDate)
        }
      }
    }
  }, [temporalData])

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
            const filteredData = filterDataByTime(data.data.data, column, currentTime)
            createLayer(subslice, data, filteredData)
          }
        }
      })
    }
  }, [currentTime, temporalData, visibleLayers, filterDataByTime, createLayer, props.payload.data.slices])

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport || props.viewport}
      layers={layers}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
      onViewportChange={setViewport}
      height={height}
      width={width}
    >
      {timeRange && Object.keys(temporalData).length > 0 && (
        <StyledTimeSlider>
          <div className="time-label">
            {currentTime?.toLocaleDateString()}
          </div>
          <Slider
            min={timeRange[0].getTime()}
            max={timeRange[1].getTime()}
            value={currentTime?.getTime() ?? timeRange[1].getTime()}
            onChange={(value: number) => setCurrentTime(new Date(value))}
            tipFormatter={(value: number) => new Date(value).toLocaleDateString()}
          />
        </StyledTimeSlider>
      )}
      <Card style={{ 
        position: 'absolute', 
        top: '1rem', 
        left: '1rem', 
        width: '18rem', 
        zIndex: 10
      }}>
        <CardHeader>
          <CardTitle>Layers</CardTitle>
          <GuideText>
            <span>ⓘ Toggle visibility using eye icon</span>
            <span>ⓘ Drag and drop to reorder layers</span>
          </GuideText>
        </CardHeader>
        <div style={{ padding: '0.5rem 0' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="layers">
              {(provided: any) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {layerOrder.map((id, index) => {
                    const subslice = props.payload.data.slices.find((slice: any) => slice.slice_id === id)
                    return (
                      <Draggable key={id} draggableId={id.toString()} index={index}>
                        {(draggableProvided: any, draggableSnapshot: any) => (
                          <DraggableItem
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            $isVisible={!!visibleLayers[id]}
                            isDragging={draggableSnapshot.isDragging}
                          >
                            <span className="drag-handle">
                              ☰
                            </span>
                            <span className="layer-name">{subslice?.slice_name}</span>
                            <span 
                              className="visibility-toggle"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLayerVisibility(id);
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {visibleLayers[id] ? (
                                <Icons.EyeOutlined iconSize="m" />
                              ) : (
                                <Icons.EyeInvisibleOutlined iconSize="m" />
                              )}
                            </span>
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
        </div>
      </Card>
      <LegendsContainer>
        {layerOrder
          .filter(id => visibleLayers[id])
          .map(id => {
            const subslice = props.payload.data.slices.find(slice => slice.slice_id === id);
            const layer = subSlicesLayers[id];
            
            if (!subslice || !layer) return null;

            // Get color scale and values from the layer
            const colorScale = layer[0]?.colorScale;
            const extent = layer[0]?.extent;
            const metricValues = layer[0]?.metricValues || [];
            
            if (!colorScale || !extent) return null;

            // Get formatter and metric info from form data
            const formatter = getNumberFormatter(subslice.form_data.number_format || 'SMART_NUMBER');
            const metricPrefix = subslice.form_data.metric_prefix ? `${subslice.form_data.metric_prefix} ` : '';
            const metricUnit = subslice.form_data.metric_unit ? ` ${subslice.form_data.metric_unit}` : '';
            const metricName = typeof subslice.form_data.metric === 'object' 
              ? (subslice.form_data.metric.label || subslice.form_data.metric_label || 'Metric Range')
              : (subslice.form_data.metric || subslice.form_data.metric_label || 'Metric Range');

            return (
              <ColorLegend
                key={id}
                colorScale={colorScale}
                extent={extent}
                format={formatter}
                metricPrefix={metricPrefix}
                metricUnit={metricUnit}
                values={metricValues}
                metricName={metricName}
                layerName={subslice.slice_name}
              />
            );
          })}
      </LegendsContainer>
    </DeckGLContainerStyledWrapper>
  )
}

export default memo(DeckMulti)