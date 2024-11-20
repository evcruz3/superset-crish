'use client';

import _pt from "prop-types";
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
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
    style = {}
  } = _ref;
  return /*#__PURE__*/_jsx("div", {
    style: _extends({
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }, style),
    children: children
  });
};
var CardHeader = _ref2 => {
  var {
    children
  } = _ref2;
  return /*#__PURE__*/_jsx("div", {
    style: {
      padding: '1rem',
      borderBottom: '1px solid #e5e7eb'
    },
    children: children
  });
};
var CardTitle = _ref3 => {
  var {
    children
  } = _ref3;
  return /*#__PURE__*/_jsx("h3", {
    style: {
      fontSize: '1.125rem',
      fontWeight: '600',
      color: '#1f2937'
    },
    children: children
  });
};
var CardContent = _ref4 => {
  var {
    children
  } = _ref4;
  return /*#__PURE__*/_jsx("div", {
    style: {
      padding: '1rem'
    },
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
    style: {
      height: '1rem',
      width: '1rem',
      color: '#2563eb',
      transition: 'all 150ms ease-in-out'
    }
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
    style: {
      marginLeft: '0.5rem',
      fontSize: '0.875rem',
      color: '#374151'
    },
    children: children
  });
};
var DeckMulti = props => {
  var containerRef = useRef(null);
  var [viewport, setViewport] = useState();
  var [subSlicesLayers, setSubSlicesLayers] = useState({});
  var [visibleLayers, setVisibleLayers] = useState({});
  var [layerOrder, setLayerOrder] = useState([]);
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var loadLayer = useCallback((subslice, filters) => {
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
        setLayerOrder(prevOrder => prevOrder.includes(subslice.slice_id) ? prevOrder : [...prevOrder, subslice.slice_id]); // Ensure no duplicate IDs in layerOrder
      }).catch(() => {});
    }
  }, [props.datasource, props.onAddFilter, props.onSelect, setTooltip]);
  var loadLayers = useCallback((formData, payload, viewport) => {
    setViewport(viewport);
    payload.data.slices.forEach(subslice => {
      var filters = [...(subslice.form_data.filters || []), ...(formData.filters || []), ...(formData.extra_filters || [])];
      loadLayer(subslice, filters);
      setVisibleLayers(prevVisible => _extends({}, prevVisible, {
        [subslice.slice_id]: true
      }));
    });
  }, [loadLayer]);
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
  var toggleLayerVisibility = layerId => {
    setVisibleLayers(prev => _extends({}, prev, {
      [layerId]: !prev[layerId]
    }));

    // If layer is being toggled back to visible, reinitialize it
    if (!visibleLayers[layerId]) {
      var subslice = props.payload.data.slices.find(slice => slice.slice_id === layerId);
      if (subslice) {
        var filters = [...(subslice.form_data.filters || []), ...(props.formData.filters || []), ...(props.formData.extra_filters || [])];
        loadLayer(subslice, filters);
      }
    } else {
      // Remove the layer from subSlicesLayers to prevent reuse of finalized layers
      setSubSlicesLayers(prevLayers => {
        var updatedLayers = _extends({}, prevLayers);
        delete updatedLayers[layerId];
        return updatedLayers;
      });
    }
  };
  var onDragEnd = result => {
    if (!result.destination) return;
    var reordered = Array.from(layerOrder);
    var [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setLayerOrder(reordered);

    // Reinitialize the moved layer to avoid reusing a finalized layer
    var movedLayerId = parseInt(result.draggableId, 10);
    if (!visibleLayers[movedLayerId]) {
      var subslice = props.payload.data.slices.find(slice => slice.slice_id === movedLayerId);
      if (subslice) {
        var filters = [...(subslice.form_data.filters || []), ...(props.formData.filters || []), ...(props.formData.extra_filters || [])];
        loadLayer(subslice, filters);
      }
    }
  };
  var {
    payload,
    formData,
    setControlValue,
    height,
    width
  } = props;
  var layers = layerOrder.filter(id => visibleLayers[id]).map(id => subSlicesLayers[id]);
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
        zIndex: 10
      },
      children: [/*#__PURE__*/_jsx(CardHeader, {
        children: /*#__PURE__*/_jsx(CardTitle, {
          children: "Geo Layers"
        })
      }), /*#__PURE__*/_jsx(DragDropContext, {
        onDragEnd: onDragEnd,
        children: /*#__PURE__*/_jsx(Droppable, {
          droppableId: "layers",
          children: provided => /*#__PURE__*/_jsxs("div", _extends({
            style: {
              marginTop: "1rem"
            },
            ref: provided.innerRef
          }, provided.droppableProps, {
            children: [layerOrder.map((id, index) => {
              var subslice = props.payload.data.slices.find(slice => slice.slice_id === id);
              return /*#__PURE__*/_jsx(Draggable, {
                draggableId: id.toString(),
                index: index,
                children: draggableProvided => /*#__PURE__*/_jsxs("div", _extends({
                  ref: draggableProvided.innerRef
                }, draggableProvided.draggableProps, draggableProvided.dragHandleProps, {
                  style: _extends({
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem'
                  }, draggableProvided.draggableProps.style),
                  children: [/*#__PURE__*/_jsx(Checkbox, {
                    id: "layer-" + id,
                    checked: !!visibleLayers[id],
                    onCheckedChange: () => toggleLayerVisibility(id)
                  }), /*#__PURE__*/_jsx(Label, {
                    htmlFor: "layer-" + id,
                    children: subslice == null ? void 0 : subslice.slice_name
                  }), /*#__PURE__*/_jsx("span", {
                    style: {
                      cursor: 'grab',
                      fontSize: '1rem',
                      marginLeft: 'auto'
                    },
                    children: "\u2630"
                  })]
                }))
              }, id);
            }), provided.placeholder]
          }))
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