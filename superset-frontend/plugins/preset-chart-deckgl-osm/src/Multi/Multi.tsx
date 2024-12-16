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
} from '@superset-ui/core'
import { Layer } from '@deck.gl/core'

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

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null)

  const [viewport, setViewport] = useState<Viewport>()
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer>>({})
  const [visibleLayers, setVisibleLayers] = useState<Record<number, boolean>>({})
  const [layerOrder, setLayerOrder] = useState<number[]>([])

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef
    if (current) {
      current.setTooltip(tooltip)
    }
  }, [])

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
            // if viz_type is country, fetch the geojson from the url
            if (subsliceCopy.form_data.viz_type === 'deck_country') {
              const country = subsliceCopy.form_data.select_country;
              
              const createAndSetLayer = (geoJsonData: JsonObject) => {
                const layer = layerGenerators[subsliceCopy.form_data.viz_type](
                  subsliceCopy.form_data,
                  json,
                  props.onAddFilter,
                  setTooltip,
                  geoJsonData
                );

                setSubSlicesLayers((prevLayers) => ({
                  ...prevLayers,
                  [subsliceCopy.slice_id]: layer,
                }));

                setLayerOrder((prevOrder) =>
                  prevOrder.includes(subslice.slice_id)
                    ? prevOrder
                    : [...prevOrder, subslice.slice_id],
                );
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
              const layer = layerGenerators[subsliceCopy.form_data.viz_type](
                subsliceCopy.form_data,
                json,
                props.onAddFilter,
                setTooltip,
                props.datasource,
                [],
                props.onSelect,
              );

              setSubSlicesLayers((prevLayers) => ({
                ...prevLayers,
                [subsliceCopy.slice_id]: layer,
              }));

              setLayerOrder((prevOrder) =>
                prevOrder.includes(subslice.slice_id)
                  ? prevOrder
                  : [...prevOrder, subslice.slice_id],
              );
            }
          })
          .catch(() => {});
      }
    },
    [props.datasource, props.onAddFilter, props.onSelect, setTooltip],
  );

  const loadLayers = useCallback(
    (formData: QueryFormData, payload: JsonObject, viewport?: Viewport) => {
      setViewport(viewport)
      payload.data.slices.forEach((subslice: { slice_id: number } & JsonObject) => {
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