'use client'

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
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

// Custom Card component
const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style = {} }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', ...style }}>
    {children}
  </div>
)

const CardHeader: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
    {children}
  </div>
)

const CardTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
    {children}
  </h3>
)

const CardContent: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ padding: '1rem' }}>
    {children}
  </div>
)

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
            const layer = layerGenerators[subsliceCopy.form_data.viz_type](
              subsliceCopy.form_data,
              json,
              props.onAddFilter,
              setTooltip,
              props.datasource,
              [],
              props.onSelect,
            )
            setSubSlicesLayers((prevLayers) => ({
              ...prevLayers,
              [subsliceCopy.slice_id]: layer,
            }))
          })
          .catch(() => {})
      }
    },
    [props.datasource, props.onAddFilter, props.onSelect, setTooltip],
  )

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
    if (!visibleLayers[layerId]) {
      const subslice = props.payload.data.slices.find((slice) => slice.slice_id === layerId)
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
  const layers = Object.entries(subSlicesLayers)
    .filter(([id]) => visibleLayers[Number(id)])
    .map(([, layer]) => layer)

  console.log(payload.data.slices)

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
          <CardTitle>Geo Layers</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(props.payload.data.slices as JsonObject).map(([index, subslice]) => (
            <div key={subslice.slice_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Checkbox
                id={`layer-${subslice.slice_id}`}
                checked={!!visibleLayers[subslice.slice_id]}
                onCheckedChange={() => toggleLayerVisibility(subslice.slice_id)}
              />
              <Label htmlFor={`layer-${subslice.slice_id}`}>{subslice.slice_name}</Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </DeckGLContainerStyledWrapper>
  )
}

export default memo(DeckMulti)