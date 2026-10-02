import * as __ext0 from "react";
import * as __ext1 from "react-dom";
const __M = (() => {
  const require = (m) => { if (m === "react") return __ext0.default || __ext0;
if (m === "react-dom") return __ext1.default || __ext1; throw new Error('ext ' + m); };
  const exports = {};
  const module = { exports };
  const process = { env: { NODE_ENV: 'production' } };
  "use strict";

// node_modules/react-dom/client.js
var m = require("react-dom");
if (false) {
  exports.createRoot = m.createRoot;
  exports.hydrateRoot = m.hydrateRoot;
} else {
  i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  exports.createRoot = function(c, o) {
    i.usingClientEntryPoint = true;
    try {
      return m.createRoot(c, o);
    } finally {
      i.usingClientEntryPoint = false;
    }
  };
  exports.hydrateRoot = function(c, h, o) {
    i.usingClientEntryPoint = true;
    try {
      return m.hydrateRoot(c, h, o);
    } finally {
      i.usingClientEntryPoint = false;
    }
  };
}
var i;

  return module.exports;
})();
export default __M;
export const createRoot = __M.createRoot;
export const hydrateRoot = __M.hydrateRoot;
