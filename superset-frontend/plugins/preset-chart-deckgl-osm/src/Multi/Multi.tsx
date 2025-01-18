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
} from '@superset-ui/core'
import { Layer } from '@deck.gl/core'
import { Slider } from 'antd'

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
  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
    {children}
  </h3>
)

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
      
      orderedSlices.forEach((subslice: { slice_id: number } & JsonObject) => {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(formData.filters || []),
          ...(formData.extra_filters || []),
        ]
        loadLayer(subslice, filters)
        setVisibleLayers((prevVisible) => ({
          ...prevVisible,
          [subslice.slice_id]: true,
        }))
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
      <Card style={{ position: 'absolute', top: '1rem', left: '1rem', width: '16rem', zIndex: 10 }}>
        <CardHeader>
          <CardTitle>Layers</CardTitle>
        </CardHeader>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="layers">
            {(provided: any) => (
              <div style={{marginTop: "1rem"}} ref={provided.innerRef} {...provided.droppableProps}>
                {layerOrder.map((id, index) => {
                  const subslice = props.payload.data.slices.find((slice: any) => slice.slice_id === id)
                  return (
                    <Draggable key={id} draggableId={id.toString()} index={index}>
                      {(draggableProvided: any) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          {...draggableProvided.dragHandleProps}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            paddingLeft: '1rem',
                            paddingRight: '1rem',
                            ...draggableProvided.draggableProps.style,
                          }}
                        >
                          <Checkbox
                            id={`layer-${id}`}
                            checked={!!visibleLayers[id]}
                            onCheckedChange={() => toggleLayerVisibility(id)}
                          />
                          <Label htmlFor={`layer-${id}`}>{subslice?.slice_name}</Label>
                          <span style={{ cursor: 'grab', fontSize: '1rem', marginLeft: 'auto' }}>☰</span>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </Card>
    </DeckGLContainerStyledWrapper>
  )
}

export default memo(DeckMulti)