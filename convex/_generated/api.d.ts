/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as crons from "../crons.js";
import type * as e2e from "../e2e.js";
import type * as http from "../http.js";
import type * as lib_admins from "../lib/admins.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_http from "../lib/http.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_reminderInput from "../lib/reminderInput.js";
import type * as lib_signature from "../lib/signature.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_validators from "../lib/validators.js";
import type * as loans from "../loans.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  automation: typeof automation;
  crons: typeof crons;
  e2e: typeof e2e;
  http: typeof http;
  "lib/admins": typeof lib_admins;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/events": typeof lib_events;
  "lib/functions": typeof lib_functions;
  "lib/http": typeof lib_http;
  "lib/logger": typeof lib_logger;
  "lib/permissions": typeof lib_permissions;
  "lib/reminderInput": typeof lib_reminderInput;
  "lib/signature": typeof lib_signature;
  "lib/text": typeof lib_text;
  "lib/validators": typeof lib_validators;
  loans: typeof loans;
  seed: typeof seed;
  tools: typeof tools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
