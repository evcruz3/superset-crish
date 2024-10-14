"use strict";

exports.__esModule = true;
exports.getBreakPointColorScaler = getBreakPointColorScaler;
exports.getBreakPoints = getBreakPoints;
exports.getBuckets = getBuckets;
var _d3Array = require("d3-array");
var _d3Scale = require("d3-scale");
var _core = require("@superset-ui/core");
var _lodash = require("lodash");
var _colors = require("./utils/colors");
/* eslint-disable no-negated-condition */
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

var DEFAULT_NUM_BUCKETS = 10;
function getBreakPoints(_ref, features, accessor) {
  var {
    break_points: formDataBreakPoints,
    num_buckets: formDataNumBuckets
  } = _ref;
  if (!features) {
    return [];
  }
  if (formDataBreakPoints === undefined || formDataBreakPoints.length === 0) {
    // compute evenly distributed break points based on number of buckets
    var numBuckets = formDataNumBuckets ? parseInt(formDataNumBuckets, 10) : DEFAULT_NUM_BUCKETS;
    var [minValue, maxValue] = (0, _d3Array.extent)(features, accessor).map(value => typeof value === 'string' ? parseFloat(value) : value);
    if (minValue === undefined || maxValue === undefined) {
      return [];
    }
    var delta = (maxValue - minValue) / numBuckets;
    var precision = delta === 0 ? 0 : Math.max(0, Math.ceil(Math.log10(1 / delta)));
    var extraBucket = maxValue > parseFloat(maxValue.toFixed(precision)) ? 1 : 0;
    var startValue = minValue < parseFloat(minValue.toFixed(precision)) ? minValue - 1 : minValue;
    return new Array(numBuckets + 1 + extraBucket).fill(0).map((_, i) => (startValue + i * delta).toFixed(precision));
  }
  return formDataBreakPoints.sort((a, b) => parseFloat(a) - parseFloat(b));
}
function getBreakPointColorScaler(_ref2, features, accessor) {
  var {
    break_points: formDataBreakPoints,
    num_buckets: formDataNumBuckets,
    linear_color_scheme: linearColorScheme,
    opacity
  } = _ref2;
  var breakPoints = formDataBreakPoints || formDataNumBuckets ? getBreakPoints({
    break_points: formDataBreakPoints,
    num_buckets: formDataNumBuckets
  }, features, accessor) : null;
  var colorScheme = Array.isArray(linearColorScheme) ? new _core.SequentialScheme({
    colors: linearColorScheme,
    id: 'custom'
  }) : (0, _core.getSequentialSchemeRegistry)().get(linearColorScheme);
  if (!colorScheme) {
    return null;
  }
  var scaler;
  var maskPoint;
  if (breakPoints !== null) {
    // bucket colors into discrete colors
    var n = breakPoints.length - 1;
    var bucketedColors = n > 1 ? colorScheme.getColors(n) : [colorScheme.colors[colorScheme.colors.length - 1]];

    // repeat ends
    var first = bucketedColors[0];
    var last = bucketedColors[bucketedColors.length - 1];
    bucketedColors.unshift(first);
    bucketedColors.push(last);
    var points = breakPoints.map(parseFloat);
    scaler = (0, _d3Scale.scaleThreshold)().domain(points).range(bucketedColors);
    maskPoint = value => !!value && (value > points[n] || value < points[0]);
  } else {
    // interpolate colors linearly
    var linearScaleDomain = (0, _d3Array.extent)(features, accessor);
    if (!linearScaleDomain.some(_lodash.isNumber)) {
      scaler = colorScheme.createLinearScale();
    } else {
      scaler = colorScheme.createLinearScale((0, _d3Array.extent)(features, accessor));
    }
    maskPoint = () => false;
  }
  return d => {
    var v = accessor(d);
    if (!v) {
      return [0, 0, 0, 0];
    }
    var c = (0, _colors.hexToRGB)(scaler(v));
    if (maskPoint(v)) {
      c[3] = 0;
    } else {
      c[3] = opacity / 100 * 255;
    }
    return c;
  };
}
function getBuckets(fd, features, accessor) {
  var breakPoints = getBreakPoints(fd, features, accessor);
  var colorScaler = getBreakPointColorScaler(fd, features, accessor);
  var buckets = {};
  breakPoints.slice(1).forEach((value, i) => {
    var range = breakPoints[i] + " - " + breakPoints[i + 1];
    var mid = 0.5 * (parseFloat(breakPoints[i]) + parseFloat(breakPoints[i + 1]));
    // fix polygon doesn't show
    var metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
    buckets[range] = {
      color: colorScaler == null ? void 0 : colorScaler({
        [metricLabel || fd.metric]: mid
      }),
      enabled: true
    };
  });
  return buckets;
}