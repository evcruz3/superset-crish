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
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`}>
    {children}
  </div>
)

const CardHeader: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="px-4 py-3 border-b border-gray-200">
    {children}
  </div>
)

const CardTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h3 className="text-lg font-semibold text-gray-800">
    {children}
  </h3>
)

const CardContent: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="p-4">
    {children}
  </div>
)

// Custom Checkbox component
const Checkbox: React.FC<{
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}> = ({ id, checked, onCheckedChange }) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
  />
)

// Custom Label component
const Label: React.FC<React.PropsWithChildren<{ htmlFor: string }>> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="ml-2 text-sm text-gray-700">
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

  const loadLayers = useCallback(
    (formData: QueryFormData, payload: JsonObject, viewport?: Viewport) => {
      setViewport(viewport)
      setSubSlicesLayers({})
      setVisibleLayers({})
      payload.data.slices.forEach((subslice: { slice_id: number } & JsonObject) => {
        const filters = [
          ...(subslice.form_data.filters || []),
          ...(formData.filters || []),
          ...(formData.extra_filters || []),
        ]
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
              setSubSlicesLayers(prevLayers => ({
                ...prevLayers,
                [subsliceCopy.slice_id]: layer,
              }))
              setVisibleLayers(prevVisible => ({
                ...prevVisible,
                [subsliceCopy.slice_id]: true,
              }))
            })
            .catch(() => {})
        }
      })
    },
    [props.datasource, props.onAddFilter, props.onSelect, setTooltip],
  )

  const prevDeckSlices = usePrevious(props.formData.deck_slices)
  useEffect(() => {
    const { formData, payload } = props
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices)
    if (hasChanges) {
      loadLayers(formData, payload)
    }
  }, [loadLayers, prevDeckSlices, props])

  const { payload, formData, setControlValue, height, width } = props
  const layers = Object.entries(subSlicesLayers)
  .map(([id, layer]) => ({
    ...layer,
    visible: visibleLayers[Number(id)] !== false,
  }))

  const toggleLayerVisibility = (layerId: number) => {
    setVisibleLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId],
    }))
  }

  return (
    <div className="relative w-full h-full">
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
      />
      <Card className="absolute top-4 left-4 z-10 w-64 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Layers</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(subSlicesLayers).map(([id, layer]) => (
            <div key={id} className="flex items-center space-x-2 mb-2">
              <Checkbox
                id={`layer-${id}`}
                checked={visibleLayers[Number(id)]}
                onCheckedChange={() => toggleLayerVisibility(Number(id))}
              />
              <Label htmlFor={`layer-${id}`}>{layer.id}</Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default memo(DeckMulti)