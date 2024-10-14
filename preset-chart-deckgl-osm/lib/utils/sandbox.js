"use strict";

exports.__esModule = true;
exports.default = sandboxedEval;
var _vm = _interopRequireDefault(require("vm"));
var _underscore = _interopRequireDefault(require("underscore"));
var d3array = _interopRequireWildcard(require("d3-array"));
var colors = _interopRequireWildcard(require("./colors"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); } /**
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
 */ // A safe alternative to JS's eval
// Objects exposed here should be treated like a public API
// if `underscore` had backwards incompatible changes in a future release, we'd
// have to be careful about bumping the library as those changes could break user charts
var GLOBAL_CONTEXT = {
  console,
  _: _underscore.default,
  colors,
  d3array
};

// Copied/modified from https://github.com/hacksparrow/safe-eval/blob/master/index.js
function sandboxedEval(code, context, opts) {
  var sandbox = {};
  var resultKey = "SAFE_EVAL_" + Math.floor(Math.random() * 1000000);
  sandbox[resultKey] = {};
  var codeToEval = resultKey + "=" + code;
  var sandboxContext = _extends({}, GLOBAL_CONTEXT, context);
  Object.keys(sandboxContext).forEach(key => {
    sandbox[key] = sandboxContext[key];
  });
  try {
    _vm.default.runInNewContext(codeToEval, sandbox, opts);
    return sandbox[resultKey];
  } catch (error) {
    return () => error;
  }
}