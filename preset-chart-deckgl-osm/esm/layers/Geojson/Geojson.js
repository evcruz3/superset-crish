function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { memo, useCallback, useMemo, useRef } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import geojsonExtent from '@mapbox/geojson-extent';
import { DeckGLContainerStyledWrapper } from '../../DeckGLContainer';
import { hexToRGB } from '../../utils/colors';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import fitViewport from '../../utils/fitViewport';
import { jsx as _jsx } from "react/jsx-runtime";
var propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  'stroke': 'strokeColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity'
};
var alterProps = (props, propOverrides) => {
  var newProps = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      console.log("has propertyMap: " + k);
      console.log(props[k]);
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });
  if (typeof newProps.fillColor === 'string') {
    newProps.fillColor = hexToRGB(newProps.fillColor);
  }
  if (typeof newProps.strokeColor === 'string') {
    newProps.strokeColor = hexToRGB(newProps.strokeColor);
  }

  // console.log(typeof props.fillColor )
  // console.log(typeof newProps.fillColor)

  var output = _extends({}, newProps);
  console.log(output);
  return output;
};
var features;
var recurseGeoJson = (node, propOverrides, extraProps) => {
  if (node != null && node.features) {
    node.features.forEach(obj => {
      recurseGeoJson(obj, propOverrides, node.extraProps || extraProps);
    });
  }
  if (node != null && node.geometry) {
    var newNode = _extends({}, node, {
      properties: alterProps(node.properties, propOverrides)
    });
    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }
    features.push(newNode);
  }
};
function setTooltipContent(o) {
  var _o$object;
  return ((_o$object = o.object) == null ? void 0 : _o$object.extraProps) && /*#__PURE__*/_jsx("div", {
    className: "deckgl-tooltip",
    children: Object.keys(o.object.extraProps).map((prop, index) => {
      var _o$object$extraProps;
      return /*#__PURE__*/_jsx(TooltipRow, {
        label: prop + ": ",
        value: "" + ((_o$object$extraProps = o.object.extraProps) == null ? void 0 : _o$object$extraProps[prop])
      }, "prop-" + index);
    })
  });
}
var getFillColor = feature => {
  var _feature$properties;
  return feature == null || (_feature$properties = feature.properties) == null ? void 0 : _feature$properties.fillColor;
};
var getLineColor = feature => {
  var _feature$properties2;
  return feature == null || (_feature$properties2 = feature.properties) == null ? void 0 : _feature$properties2.strokeColor;
};
export function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var fc = fd.fill_color_picker;
  var sc = fd.stroke_color_picker;
  var fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  var strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  var propOverrides = {};
  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }
  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }
  features = [];
  recurseGeoJson(payload.data, propOverrides);
  var jsFnMutator;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = sandboxedEval(fd.js_data_mutator);
    features = jsFnMutator(features);
  }
  return new GeoJsonLayer(_extends({
    id: "geojson-layer-" + fd.slice_id,
    data: features,
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    opacity: 0.5,
    getFillColor,
    getLineColor,
    getLineWidth: fd.line_width || 1,
    pointRadiusScale: fd.point_radius_scale,
    lineWidthUnits: fd.line_width_unit
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
}
var DeckGLGeoJson = props => {
  var _payload$data2;
  var containerRef = useRef();
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var {
    formData,
    payload,
    setControlValue,
    onAddFilter,
    height,
    width
  } = props;
  var viewport = useMemo(() => {
    if (formData.autozoom) {
      var _payload$data;
      var points = (payload == null || (_payload$data = payload.data) == null || (_payload$data = _payload$data.features) == null || _payload$data.reduce == null ? void 0 : _payload$data.reduce((acc, feature) => {
        var bounds = geojsonExtent(feature);
        if (bounds) {
          return [...acc, [bounds[0], bounds[1]], [bounds[2], bounds[3]]];
        }
        return acc;
      }, [])) || [];
      if (points.length) {
        return fitViewport(props.viewport, {
          width,
          height,
          points
        });
      }
    }
    return props.viewport;
  }, [formData.autozoom, height, payload == null || (_payload$data2 = payload.data) == null ? void 0 : _payload$data2.features, props.viewport, width]);
  var layer = getLayer(formData, payload, onAddFilter, setTooltip);
  console.log("formData: ");
  console.log(formData);
  console.log("Payload: ");
  console.log(payload);
  return /*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
    ref: containerRef,
    mapboxApiAccessToken: payload.data.mapboxApiKey,
    viewport: viewport,
    layers: [layer],
    mapStyle: formData.mapbox_style,
    setControlValue: setControlValue,
    height: height,
    width: width
  });
};
export default /*#__PURE__*/memo(DeckGLGeoJson);