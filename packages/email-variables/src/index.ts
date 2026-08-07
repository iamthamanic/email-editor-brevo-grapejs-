/**
 * Shared Brevo params variable registry for editor + API.
 * Location: packages/email-variables/src/index.ts
 */

export {
  EMAIL_VARIABLES,
  getVariable,
  groupVariables,
  isKnownVariableKey,
  listVariableKeys,
} from "./registry.js";
export type { VariableDef, VariableGroup } from "./registry.js";

export {
  extractParamKeys,
  isValidExpression,
  isValidParamPath,
  PARAM_EXPR_GLOBAL,
  PARAM_PATH,
  PARAM_SEGMENT,
  splitParamExpressions,
  toExpression,
} from "./expression.js";

export { getSampleData } from "./sample.js";
export type { SampleData } from "./sample.js";

export { substituteParams } from "./substitute.js";
