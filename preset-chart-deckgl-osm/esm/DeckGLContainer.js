var _templateObject;
var _excluded = ["data"];
function _taggedTemplateLiteralLoose(e, t) { return t || (t = e.slice(0)), e.raw = t, e; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (e.includes(n)) continue; t[n] = r[n]; } return t; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState, useMemo } from 'react';
import { isEqual } from 'lodash';
import DeckGL from 'deck.gl';
import { styled, usePrevious } from '@superset-ui/core';
import Tooltip from './components/Tooltip';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
var TICK = 250; // milliseconds

export var DeckGLContainer = /*#__PURE__*/memo(/*#__PURE__*/forwardRef((props, ref) => {
  var [tooltip, setTooltip] = useState(null);
  var [lastUpdate, setLastUpdate] = useState(null);
  var [viewState, setViewState] = useState(props.viewport);
  var prevViewport = usePrevious(props.viewport);
  useImperativeHandle(ref, () => ({
    setTooltip,
    toggleLayerVisibility: layerId => {
      var updatedLayers = props.layers.map(l => l.id === layerId ? _extends({}, l, {
        visible: !l.visible
      }) : l);
      if (props.onLayerVisibilityChange) {
        var layer = updatedLayers.find(l => l.id === layerId);
        if (layer) {
          props.onLayerVisibilityChange(layerId, layer.visible);
        }
      }
    }
  }), [props.layers, props.onLayerVisibilityChange]);
  var tick = useCallback(() => {
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      var setCV = props.setControlValue;
      if (setCV) {
        setCV('viewport', viewState);
      }
      setLastUpdate(null);
    }
  }, [lastUpdate, props.setControlValue, viewState]);
  useEffect(() => {
    var timer = setInterval(tick, TICK);
    return () => clearInterval(timer);
  }, [tick]);
  useEffect(() => {
    if (!isEqual(props.viewport, prevViewport)) {
      setViewState(props.viewport);
    }
  }, [props.viewport, prevViewport]);
  var onViewStateChange = useCallback(_ref => {
    var {
      viewState
    } = _ref;
    setViewState(viewState);
    setLastUpdate(Date.now());
    if (props.setControlValue) {
      props.setControlValue('viewport', viewState);
    }
  }, [props.setControlValue]);
  var osmTileLayer = useMemo(() => new TileLayer({
    id: 'osm-tile-layer',
    data: props.mapStyle,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      var [[west, south], [east, north]] = props.tile.boundingBox;
      var {
          data
        } = props,
        otherProps = _objectWithoutPropertiesLoose(props, _excluded);
      return [new BitmapLayer(otherProps, {
        image: data,
        bounds: [west, south, east, north]
      })];
    }
  }), [props.mapStyle]);
  var layers = useMemo(() => {
    var visibleLayers = props.layers.filter(l => l.visible);
    return [osmTileLayer, ...visibleLayers.map(l => typeof l.layer === 'function' ? l.layer() : l.layer)];
  }, [osmTileLayer, props.layers]);
  var {
    children = null,
    height,
    width
  } = props;
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      style: {
        position: 'relative',
        width,
        height
      },
      children: [/*#__PURE__*/_jsx(DeckGL, {
        controller: true,
        width: width,
        height: height,
        layers: layers,
        viewState: viewState,
        glOptions: {
          preserveDrawingBuffer: true
        },
        onViewStateChange: onViewStateChange
      }), children]
    }), /*#__PURE__*/_jsx(Tooltip, {
      tooltip: tooltip
    })]
  });
}));
export var DeckGLContainerStyledWrapper = styled(DeckGLContainer)(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  .deckgl-tooltip > div {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n"])));