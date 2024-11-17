'use client';

var _templateObject;
var _excluded = ["data"];
function _taggedTemplateLiteralLoose(e, t) { return t || (t = e.slice(0)), e.raw = t, e; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (e.includes(n)) continue; t[n] = r[n]; } return t; }
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState, useMemo } from 'react';
import { isEqual } from 'lodash';
import DeckGL from 'deck.gl';
import { styled } from '@superset-ui/core';
import Tooltip from './components/Tooltip';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
var TICK = 250; // milliseconds

// Custom Card component
var Card = _ref => {
  var {
    children,
    className = ''
  } = _ref;
  return /*#__PURE__*/_jsx("div", {
    className: "bg-white shadow-md rounded-lg " + className,
    children: children
  });
};

// Custom CardContent component
var CardContent = _ref2 => {
  var {
    children
  } = _ref2;
  return /*#__PURE__*/_jsx("div", {
    className: "p-4",
    children: children
  });
};

// Custom Checkbox component
var Checkbox = _ref3 => {
  var {
    id,
    checked,
    onCheckedChange
  } = _ref3;
  return /*#__PURE__*/_jsx("input", {
    type: "checkbox",
    id: id,
    checked: checked,
    onChange: onCheckedChange,
    className: "form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
  });
};

// Custom Label component
var Label = _ref4 => {
  var {
    htmlFor,
    children
  } = _ref4;
  return /*#__PURE__*/_jsx("label", {
    htmlFor: htmlFor,
    className: "ml-2 text-sm text-gray-700",
    children: children
  });
};
export var DeckGLContainer = /*#__PURE__*/memo(/*#__PURE__*/forwardRef((props, ref) => {
  var [tooltip, setTooltip] = useState(null);
  var [lastUpdate, setLastUpdate] = useState(null);
  var [viewState, setViewState] = useState(props.viewport);
  var [visibleLayers, setVisibleLayers] = useState(props.layers.map(() => true));
  useImperativeHandle(ref, () => ({
    setTooltip
  }), []);
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
    if (!isEqual(props.viewport, viewState)) {
      setViewState(props.viewport);
    }
  }, [props.viewport, viewState]);
  var onViewStateChange = useCallback(_ref5 => {
    var {
      viewState
    } = _ref5;
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
    var layersWithVisibility = props.layers.map((l, index) => {
      var layer = typeof l === 'function' ? l() : l;
      return _extends({}, layer, {
        visible: visibleLayers[index]
      });
    });
    return [osmTileLayer, ...layersWithVisibility];
  }, [osmTileLayer, props.layers, visibleLayers]);
  var toggleLayerVisibility = index => {
    setVisibleLayers(prev => {
      var newVisibleLayers = [...prev];
      newVisibleLayers[index] = !newVisibleLayers[index];
      return newVisibleLayers;
    });
  };
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
        onViewStateChange: onViewStateChange,
        children: children
      }), /*#__PURE__*/_jsx(Card, {
        className: "absolute top-4 left-4 z-10 w-64",
        children: /*#__PURE__*/_jsxs(CardContent, {
          children: [/*#__PURE__*/_jsx("h3", {
            className: "mb-2 font-bold text-lg",
            children: "Layers"
          }), props.layers.map((layer, index) => /*#__PURE__*/_jsxs("div", {
            className: "flex items-center space-x-2 mb-2",
            children: [/*#__PURE__*/_jsx(Checkbox, {
              id: "layer-" + index,
              checked: visibleLayers[index],
              onCheckedChange: () => toggleLayerVisibility(index)
            }), /*#__PURE__*/_jsx(Label, {
              htmlFor: "layer-" + index,
              children: typeof layer === 'function' ? "Layer " + (index + 1) : layer.id || "Layer " + (index + 1)
            })]
          }, index))]
        })
      })]
    }), /*#__PURE__*/_jsx(Tooltip, {
      tooltip: tooltip
    })]
  });
}));
export var DeckGLContainerStyledWrapper = styled(DeckGLContainer)(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  .deckgl-tooltip > div {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n"])));