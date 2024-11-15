"use strict";

exports.__esModule = true;
exports.getExploreLongUrl = getExploreLongUrl;
exports.getURIDirectory = getURIDirectory;
var _urijs = _interopRequireDefault(require("urijs"));
var _safeStringify = require("./safeStringify");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

var MAX_URL_LENGTH = 8000;
function getURIDirectory(endpointType) {
  if (endpointType === void 0) {
    endpointType = 'base';
  }
  // Building the directory part of the URI
  var directory = '/explore/';
  if (['json', 'csv', 'query', 'results', 'samples'].includes(endpointType)) {
    directory = '/superset/explore_json/';
  }
  return directory;
}
function getExploreLongUrl(formData, endpointType, allowOverflow, extraSearch) {
  if (allowOverflow === void 0) {
    allowOverflow = true;
  }
  if (extraSearch === void 0) {
    extraSearch = {};
  }
  if (!formData.datasource) {
    return undefined;
  }
  var uri = new _urijs.default('/');
  var directory = getURIDirectory(endpointType);
  var search = uri.search(true);
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  search.form_data = (0, _safeStringify.safeStringify)(formData);
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  var url = uri.directory(directory).search(search).toString();
  if (!allowOverflow && url.length > MAX_URL_LENGTH) {
    var minimalFormData = {
      datasource: formData.datasource,
      viz_type: formData.viz_type
    };
    return getExploreLongUrl(minimalFormData, endpointType, false, {
      URL_IS_TOO_LONG_TO_SHARE: null
    });
  }
  return url;
}