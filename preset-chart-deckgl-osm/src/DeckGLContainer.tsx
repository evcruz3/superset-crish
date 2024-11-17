'use client'

import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react'
import { isEqual } from 'lodash'
import { Layer } from '@deck.gl/core'
import DeckGL from 'deck.gl'
import { JsonObject, JsonValue, styled } from '@superset-ui/core'
import Tooltip, { TooltipProps } from './components/Tooltip'
import { Viewport } from './utils/fitViewport'
import { TileLayer } from '@deck.gl/geo-layers'
import { BitmapLayer } from '@deck.gl/layers'

const TICK = 250 // milliseconds

// Custom Card component
const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white shadow-md rounded-lg ${className}`}>
    {children}
  </div>
)

// Custom CardContent component
const CardContent = ({ children }: { children: ReactNode }) => (
  <div className="p-4">
    {children}
  </div>
)

// Custom Checkbox component
const Checkbox = ({ id, checked, onCheckedChange }: { id: string; checked: boolean; onCheckedChange: () => void }) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={onCheckedChange}
    className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
  />
)

// Custom Label component
const Label = ({ htmlFor, children }: { htmlFor: string; children: ReactNode }) => (
  <label htmlFor={htmlFor} className="ml-2 text-sm text-gray-700">
    {children}
  </label>
)

export type DeckGLContainerProps = {
  viewport: Viewport
  setControlValue?: (control: string, value: JsonValue) => void
  mapStyle?: string
  mapboxApiAccessToken: string
  children?: ReactNode
  width: number
  height: number
  layers: (Layer | (() => Layer))[]
  onViewportChange?: (viewport: Viewport) => void
}

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null)
    const [lastUpdate, setLastUpdate] = useState<number | null>(null)
    const [viewState, setViewState] = useState(props.viewport)
    const [visibleLayers, setVisibleLayers] = useState<boolean[]>(props.layers.map(() => true))

    useImperativeHandle(ref, () => ({ setTooltip }), [])

    const tick = useCallback(() => {
      if (lastUpdate && Date.now() - lastUpdate > TICK) {
        const setCV = props.setControlValue
        if (setCV) {
          setCV('viewport', viewState)
        }
        setLastUpdate(null)
      }
    }, [lastUpdate, props.setControlValue, viewState])

    useEffect(() => {
      const timer = setInterval(tick, TICK)
      return () => clearInterval(timer)
    }, [tick])

    useEffect(() => {
      if (!isEqual(props.viewport, viewState)) {
        setViewState(props.viewport)
      }
    }, [props.viewport, viewState])

    const onViewStateChange = useCallback(
      ({ viewState }: { viewState: JsonObject }) => {
        setViewState(viewState as Viewport)
        setLastUpdate(Date.now())
        if (props.setControlValue) {
          props.setControlValue('viewport', viewState)
        }
      },
      [props.setControlValue]
    )

    const osmTileLayer = useMemo(() => new TileLayer({
      id: 'osm-tile-layer',
      data: props.mapStyle,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const [[west, south], [east, north]] = props.tile.boundingBox
        const {data, ...otherProps} = props
  
        return [
          new BitmapLayer(otherProps, {
            image: data,
            bounds: [west, south, east, north]
          })
        ]
      }
    }), [props.mapStyle])

    const layers = useMemo(() => {
      const layersWithVisibility = props.layers.map((l, index) => {
        const layer = typeof l === 'function' ? l() : l
        return {
          ...layer,
          visible: visibleLayers[index]
        }
      })
      return [osmTileLayer, ...layersWithVisibility] as Layer[]
    }, [osmTileLayer, props.layers, visibleLayers])

    const toggleLayerVisibility = (index: number) => {
      setVisibleLayers(prev => {
        const newVisibleLayers = [...prev]
        newVisibleLayers[index] = !newVisibleLayers[index]
        return newVisibleLayers
      })
    }

    const { children = null, height, width } = props

    return (
      <>
        <div style={{ position: 'relative', width, height }}>
          <DeckGL
            controller
            width={width}
            height={height}
            layers={layers}
            viewState={viewState}
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={onViewStateChange}
          >
            {children}
          </DeckGL>
          <Card className="absolute top-4 left-4 z-10 w-64">
            <CardContent>
              <h3 className="mb-2 font-bold text-lg">Layers</h3>
              {props.layers.map((layer, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id={`layer-${index}`}
                    checked={visibleLayers[index]}
                    onCheckedChange={() => toggleLayerVisibility(index)}
                  />
                  <Label htmlFor={`layer-${index}`}>
                    {typeof layer === 'function' ? `Layer ${index + 1}` : layer.id || `Layer ${index + 1}`}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Tooltip tooltip={tooltip} />
      </>
    )
  })
)

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export type DeckGLContainerHandle = typeof DeckGLContainer & {
  setTooltip: (tooltip: ReactNode) => void
}