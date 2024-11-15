"use strict";

exports.__esModule = true;
exports.PRIMARY_COLOR = void 0;
exports.columnChoices = columnChoices;
exports.default = void 0;
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

function columnChoices(datasource) {
  if (datasource != null && datasource.columns) {
    return datasource.columns.map(col => [col.column_name, col.verbose_name || col.column_name]).sort((opt1, opt2) => opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1);
  }
  return [];
}
var PRIMARY_COLOR = exports.PRIMARY_COLOR = {
  r: 0,
  g: 122,
  b: 135,
  a: 1
};
var _default = exports.default = {
  default: null,
  mapStateToProps: state => {
    var _time_grain_sqla;
    return {
      choices: state.datasource ? (_time_grain_sqla = state.datasource.time_grain_sqla) == null ? void 0 : _time_grain_sqla.filter(o => o[0] !== null) : null
    };
  }
};