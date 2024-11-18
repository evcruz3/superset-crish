'use client';

import _pt from "prop-types";
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { SupersetClient, usePrevious } from '@superset-ui/core';
import { DeckGLContainerStyledWrapper } from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Custom Card component
var Card = _ref => {
  var {
    children,
    className = ''
  } = _ref;
  return /*#__PURE__*/_jsx("div", {
    className: "bg-white rounded-lg shadow-md " + className,
    children: children
  });
};
var CardHeader = _ref2 => {
  var {
    children
  } = _ref2;
  return /*#__PURE__*/_jsx("div", {
    className: "px-4 py-3 border-b border-gray-200",
    children: children
  });
};
var CardTitle = _ref3 => {
  var {
    children
  } = _ref3;
  return /*#__PURE__*/_jsx("h3", {
    className: "text-lg font-semibold text-gray-800",
    children: children
  });
};
var CardContent = _ref4 => {
  var {
    children
  } = _ref4;
  return /*#__PURE__*/_jsx("div", {
    className: "p-4",
    children: children
  });
};

// Custom Checkbox component
var Checkbox = _ref5 => {
  var {
    id,
    checked,
    onCheckedChange
  } = _ref5;
  return /*#__PURE__*/_jsx("input", {
    type: "checkbox",
    id: id,
    checked: checked,
    onChange: e => onCheckedChange(e.target.checked),
    className: "form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
  });
};

// Custom Label component
var Label = _ref6 => {
  var {
    children,
    htmlFor
  } = _ref6;
  return /*#__PURE__*/_jsx("label", {
    htmlFor: htmlFor,
    className: "ml-2 text-sm text-gray-700",
    children: children
  });
};
var DeckMulti = props => {
  var containerRef = useRef(null);
  var [viewport, setViewport] = useState();
  var [subSlicesLayers, setSubSlicesLayers] = useState({});
  var [visibleLayers, setVisibleLayers] = useState({});
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var loadLayers = useCallback((formData, payload, viewport) => {
    setViewport(viewport);
    setSubSlicesLayers({});
    setVisibleLayers({});
    payload.data.slices.forEach(subslice => {
      var filters = [...(subslice.form_data.filters || []), ...(formData.filters || []), ...(formData.extra_filters || [])];
      var subsliceCopy = _extends({}, subslice, {
        form_data: _extends({}, subslice.form_data, {
          filters
        })
      });
      var url = getExploreLongUrl(subsliceCopy.form_data, 'json');
      if (url) {
        SupersetClient.get({
          endpoint: url
        }).then(_ref7 => {
          var {
            json
          } = _ref7;
          var layer = layerGenerators[subsliceCopy.form_data.viz_type](subsliceCopy.form_data, json, props.onAddFilter, setTooltip, props.datasource, [], props.onSelect);
          setSubSlicesLayers(prevLayers => _extends({}, prevLayers, {
            [subsliceCopy.slice_id]: layer
          }));
          setVisibleLayers(prevVisible => _extends({}, prevVisible, {
            [subsliceCopy.slice_id]: true
          }));
        }).catch(() => {});
      }
    });
  }, [props.datasource, props.onAddFilter, props.onSelect, setTooltip]);
  var prevDeckSlices = usePrevious(props.formData.deck_slices);
  useEffect(() => {
    var {
      formData,
      payload
    } = props;
    var hasChanges = !isEqual(prevDeckSlices, formData.deck_slices);
    if (hasChanges) {
      loadLayers(formData, payload);
    }
  }, [loadLayers, prevDeckSlices, props]);
  var {
    payload,
    formData,
    setControlValue,
    height,
    width
  } = props;
  var layers = Object.entries(subSlicesLayers).filter(_ref8 => {
    var [id] = _ref8;
    return visibleLayers[Number(id)];
  }).map(_ref9 => {
    var [, layer] = _ref9;
    return layer;
  });
  var toggleLayerVisibility = layerId => {
    setVisibleLayers(prev => _extends({}, prev, {
      [layerId]: !prev[layerId]
    }));
  };
  return /*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
    ref: containerRef,
    mapboxApiAccessToken: payload.data.mapboxApiKey,
    viewport: viewport || props.viewport,
    layers: layers,
    mapStyle: formData.mapbox_style,
    setControlValue: setControlValue,
    onViewportChange: setViewport,
    height: height,
    width: width,
    children: /*#__PURE__*/_jsxs(Card, {
      style: {
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        width: '16rem',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)'
      },
      children: [/*#__PURE__*/_jsx(CardHeader, {
        children: /*#__PURE__*/_jsx(CardTitle, {
          children: "Layers"
        })
      }), /*#__PURE__*/_jsx(CardContent, {
        children: Object.entries(subSlicesLayers).map(_ref10 => {
          var [id, layer] = _ref10;
          return /*#__PURE__*/_jsxs("div", {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            },
            children: [/*#__PURE__*/_jsx(Checkbox, {
              id: "layer-" + id,
              checked: visibleLayers[Number(id)],
              onCheckedChange: () => toggleLayerVisibility(Number(id))
            }), /*#__PURE__*/_jsx(Label, {
              htmlFor: "layer-" + id,
              children: layer.id
            })]
          }, id);
        })
      })]
    })
  });
};
DeckMulti.propTypes = {
  setControlValue: _pt.func.isRequired,
  height: _pt.number.isRequired,
  width: _pt.number.isRequired,
  onSelect: _pt.func.isRequired
};
export default /*#__PURE__*/memo(DeckMulti);