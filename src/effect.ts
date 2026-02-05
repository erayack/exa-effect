/**
 * Effect-native wrapper for the Exa SDK
 *
 * Provides Effect-based APIs with typed errors, dependency injection via Context.Tag,
 * and proper resource management for streaming operations.
 */

import { Context, Effect, Layer, Stream } from "effect";
import { ZodSchema } from "zod";
import { Exa } from "./client";
import {
  AnswerOptions,
  AnswerOptionsTyped,
  AnswerResponse,
  AnswerResponseTyped,
  AnswerStreamChunk,
  ContentsOptions,
  FindSimilarOptions,
  RegularSearchOptions,
  SearchResponse,
  SearchResult,
} from "./types";
import { ExaError } from "./errors";
import {
  ListResearchRequest,
  ListResearchResponse,
  Research,
  ResearchCreateParamsTyped,
  ResearchCreateRequest,
  ResearchCreateResponse,
  ResearchStreamEvent,
  ResearchTyped,
} from "./research";
import {
  CreateWebsetParameters,
  CreateWebsetSearchParameters,
  GetWebsetResponse,
  ListWebsetsResponse,
  PreviewWebsetParameters,
  PreviewWebsetResponse,
  UpdateWebsetRequest,
  Webset,
  WebsetHeadersLike,
  WebsetStatus,
  ListWebsetItemResponse,
  WebsetItem,
  WebsetSearch,
  WebsetEnrichment,
  CreateEnrichmentParameters,
  UpdateEnrichmentParameters,
  Monitor,
  CreateMonitorParameters,
  UpdateMonitor,
  ListMonitorsResponse,
  MonitorRun,
  ListMonitorRunsResponse,
  Import,
  CreateImportParameters,
  CreateImportResponse,
  ListImportsResponse,
  UpdateImport,
  Event,
  ListEventsResponse,
  Webhook,
  CreateWebhookParameters,
  UpdateWebhookParameters,
  ListWebhooksResponse,
} from "./websets";
import { ListWebsetsOptions } from "./websets/client";
import { ListWebsetItemsOptions } from "./websets/items";
import { ListMonitorsOptions } from "./websets/monitors";
import {
  CreateImportWithCsvParameters,
  CsvDataInput,
  WaitUntilCompletedOptions,
} from "./websets/imports";
import { ListEventsOptions } from "./websets/events";
import { ListWebhooksOptions } from "./websets/webhooks";
import { PaginationParams } from "./websets/base";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the Exa Effect service
 */
export type ExaConfig = {
  apiKey?: string;
  baseURL?: string;
  client?: Exa;
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Convert unknown errors to ExaError, preserving HTTP status from known error shapes
 */
const toExaError = (e: unknown): ExaError => {
  if (e instanceof ExaError) return e;

  let status = 500;
  let message = String(e);

  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;

    const coerceStatus = (val: unknown): number | undefined => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) return parsed;
      }
      return undefined;
    };

    const objStatus = coerceStatus(obj.status) ?? coerceStatus(obj.statusCode);
    if (objStatus !== undefined) {
      status = objStatus;
    } else if (obj.response && typeof obj.response === "object") {
      const resp = obj.response as Record<string, unknown>;
      const respStatus = coerceStatus(resp.status) ?? coerceStatus(resp.statusCode);
      if (respStatus !== undefined) {
        status = respStatus;
      }
    }

    if (typeof obj.message === "string") {
      message = obj.message;
    }
  }

  return new ExaError(message, status);
};

/**
 * Wrap a promise-returning function in Effect with ExaError handling
 */
const tryPromiseExa = <A>(thunk: () => Promise<A>): Effect.Effect<A, ExaError> =>
  Effect.tryPromise({
    try: thunk,
    catch: toExaError,
  });

/**
 * Convert an async generator to an Effect Stream with proper cleanup
 */
const streamFromAsyncGenerator = <A>(
  make: () => AsyncGenerator<A>
): Stream.Stream<A, ExaError> =>
  Stream.unwrapScoped(
    Effect.acquireRelease(
      Effect.sync(() => make()),
      (gen) => Effect.promise(async () => { await gen.return?.(undefined); })
    ).pipe(
      Effect.map((gen) => Stream.fromAsyncIterable(gen, toExaError))
    )
  );

// ============================================================================
// Sub-Service Interfaces
// ============================================================================

/**
 * Effect-wrapped Research service interface
 */
export interface ResearchService {
  readonly create: {
    <T>(
      params: ResearchCreateParamsTyped<ZodSchema<T>>
    ): Effect.Effect<ResearchCreateResponse, ExaError>;
    (params: {
      instructions: string;
      model?: ResearchCreateRequest["model"];
      outputSchema?: Record<string, unknown>;
    }): Effect.Effect<ResearchCreateResponse, ExaError>;
  };

  readonly get: {
    (researchId: string): Effect.Effect<Research, ExaError>;
    (
      researchId: string,
      options: { stream?: false; events?: boolean }
    ): Effect.Effect<Research, ExaError>;
    <T>(
      researchId: string,
      options: { stream?: false; events?: boolean; outputSchema: ZodSchema<T> }
    ): Effect.Effect<ResearchTyped<T>, ExaError>;
  };

  readonly stream: (
    researchId: string,
    options?: { events?: boolean; outputSchema?: ZodSchema<unknown> }
  ) => Stream.Stream<ResearchStreamEvent, ExaError>;

  readonly list: (
    options?: ListResearchRequest
  ) => Effect.Effect<ListResearchResponse, ExaError>;

  readonly pollUntilFinished: {
    (
      researchId: string,
      options?: { pollInterval?: number; timeoutMs?: number; events?: boolean }
    ): Effect.Effect<
      Research & { status: "completed" | "failed" | "canceled" },
      ExaError
    >;
    <T>(
      researchId: string,
      options: {
        pollInterval?: number;
        timeoutMs?: number;
        events?: boolean;
        outputSchema: ZodSchema<T>;
      }
    ): Effect.Effect<
      ResearchTyped<T> & { status: "completed" | "failed" | "canceled" },
      ExaError
    >;
  };
}

/**
 * Effect-wrapped Webset Items service interface
 */
export interface WebsetItemsService {
  readonly get: (
    websetId: string,
    itemId: string
  ) => Effect.Effect<WebsetItem, ExaError>;
  readonly list: (
    websetId: string,
    options?: ListWebsetItemsOptions
  ) => Effect.Effect<ListWebsetItemResponse, ExaError>;
  readonly listAll: (
    websetId: string,
    options?: ListWebsetItemsOptions
  ) => Stream.Stream<WebsetItem, ExaError>;
  readonly getAll: (
    websetId: string,
    options?: ListWebsetItemsOptions
  ) => Effect.Effect<WebsetItem[], ExaError>;
  readonly delete: (
    websetId: string,
    itemId: string
  ) => Effect.Effect<WebsetItem, ExaError>;
}

/**
 * Effect-wrapped Webset Searches service interface
 */
export interface WebsetSearchesService {
  readonly create: (
    websetId: string,
    params: CreateWebsetSearchParameters,
    options?: { headers?: WebsetHeadersLike }
  ) => Effect.Effect<WebsetSearch, ExaError>;
  readonly get: (
    websetId: string,
    searchId: string
  ) => Effect.Effect<WebsetSearch, ExaError>;
  readonly cancel: (
    websetId: string,
    searchId: string
  ) => Effect.Effect<WebsetSearch, ExaError>;
}

/**
 * Effect-wrapped Webset Enrichments service interface
 */
export interface WebsetEnrichmentsService {
  readonly create: (
    websetId: string,
    params: CreateEnrichmentParameters
  ) => Effect.Effect<WebsetEnrichment, ExaError>;
  readonly get: (
    websetId: string,
    enrichmentId: string
  ) => Effect.Effect<WebsetEnrichment, ExaError>;
  readonly update: (
    websetId: string,
    enrichmentId: string,
    params: UpdateEnrichmentParameters
  ) => Effect.Effect<void, ExaError>;
  readonly delete: (
    websetId: string,
    enrichmentId: string
  ) => Effect.Effect<WebsetEnrichment, ExaError>;
  readonly cancel: (
    websetId: string,
    enrichmentId: string
  ) => Effect.Effect<WebsetEnrichment, ExaError>;
}

/**
 * Effect-wrapped Webset Monitors service interface
 */
export interface WebsetMonitorsService {
  readonly create: (
    params: CreateMonitorParameters
  ) => Effect.Effect<Monitor, ExaError>;
  readonly get: (monitorId: string) => Effect.Effect<Monitor, ExaError>;
  readonly list: (
    options?: ListMonitorsOptions
  ) => Effect.Effect<ListMonitorsResponse, ExaError>;
  readonly update: (
    monitorId: string,
    params: UpdateMonitor
  ) => Effect.Effect<Monitor, ExaError>;
  readonly delete: (monitorId: string) => Effect.Effect<Monitor, ExaError>;
  readonly listAll: (
    options?: ListMonitorsOptions
  ) => Stream.Stream<Monitor, ExaError>;
  readonly getAll: (
    options?: ListMonitorsOptions
  ) => Effect.Effect<Monitor[], ExaError>;
  readonly runs: WebsetMonitorRunsService;
}

/**
 * Effect-wrapped Webset Monitor Runs service interface
 */
export interface WebsetMonitorRunsService {
  readonly get: (
    monitorId: string,
    runId: string
  ) => Effect.Effect<MonitorRun, ExaError>;
  readonly list: (
    monitorId: string,
    options?: PaginationParams
  ) => Effect.Effect<ListMonitorRunsResponse, ExaError>;
}

/**
 * Effect-wrapped Webset Imports service interface
 */
export interface WebsetImportsService {
  readonly create: {
    (params: CreateImportParameters): Effect.Effect<
      CreateImportResponse,
      ExaError
    >;
    (
      params: CreateImportWithCsvParameters,
      csv: CsvDataInput
    ): Effect.Effect<Import, ExaError>;
  };
  readonly get: (importId: string) => Effect.Effect<Import, ExaError>;
  readonly list: (
    options?: PaginationParams
  ) => Effect.Effect<ListImportsResponse, ExaError>;
  readonly update: (
    importId: string,
    params: UpdateImport
  ) => Effect.Effect<Import, ExaError>;
  readonly delete: (importId: string) => Effect.Effect<Import, ExaError>;
  readonly waitUntilCompleted: (
    importId: string,
    options?: WaitUntilCompletedOptions
  ) => Effect.Effect<Import, ExaError>;
  readonly listAll: (
    options?: PaginationParams
  ) => Stream.Stream<Import, ExaError>;
  readonly getAll: (
    options?: PaginationParams
  ) => Effect.Effect<Import[], ExaError>;
}

/**
 * Effect-wrapped Webset Events service interface
 */
export interface WebsetEventsService {
  readonly get: (eventId: string) => Effect.Effect<Event, ExaError>;
  readonly list: (
    options?: ListEventsOptions
  ) => Effect.Effect<ListEventsResponse, ExaError>;
  readonly listAll: (
    options?: ListEventsOptions
  ) => Stream.Stream<Event, ExaError>;
  readonly getAll: (
    options?: ListEventsOptions
  ) => Effect.Effect<Event[], ExaError>;
}

/**
 * Effect-wrapped Webset Webhooks service interface
 */
export interface WebsetWebhooksService {
  readonly create: (
    params: CreateWebhookParameters
  ) => Effect.Effect<Webhook, ExaError>;
  readonly get: (webhookId: string) => Effect.Effect<Webhook, ExaError>;
  readonly list: (
    options?: ListWebhooksOptions
  ) => Effect.Effect<ListWebhooksResponse, ExaError>;
  readonly update: (
    webhookId: string,
    params: UpdateWebhookParameters
  ) => Effect.Effect<Webhook, ExaError>;
  readonly delete: (webhookId: string) => Effect.Effect<Webhook, ExaError>;
  readonly listAll: (
    options?: ListWebhooksOptions
  ) => Stream.Stream<Webhook, ExaError>;
  readonly getAll: (
    options?: ListWebhooksOptions
  ) => Effect.Effect<Webhook[], ExaError>;
}

/**
 * Effect-wrapped Websets service interface
 */
export interface WebsetsService {
  readonly create: (
    params: CreateWebsetParameters,
    options?: { headers?: WebsetHeadersLike }
  ) => Effect.Effect<Webset, ExaError>;
  readonly preview: (
    params: PreviewWebsetParameters,
    options?: { search?: boolean }
  ) => Effect.Effect<PreviewWebsetResponse, ExaError>;
  readonly get: (
    id: string,
    expand?: Array<"items">
  ) => Effect.Effect<GetWebsetResponse, ExaError>;
  readonly list: (
    options?: ListWebsetsOptions
  ) => Effect.Effect<ListWebsetsResponse, ExaError>;
  readonly listAll: (
    options?: ListWebsetsOptions
  ) => Stream.Stream<Webset, ExaError>;
  readonly getAll: (
    options?: ListWebsetsOptions
  ) => Effect.Effect<Webset[], ExaError>;
  readonly update: (
    id: string,
    params: UpdateWebsetRequest
  ) => Effect.Effect<Webset, ExaError>;
  readonly delete: (id: string) => Effect.Effect<Webset, ExaError>;
  readonly cancel: (id: string) => Effect.Effect<Webset, ExaError>;
  readonly waitUntilIdle: (
    id: string,
    options?:
      | {
          timeout?: number;
          pollInterval?: number;
          onPoll?: (status: WebsetStatus) => void;
        }
      | number
  ) => Effect.Effect<Webset, ExaError>;

  readonly items: WebsetItemsService;
  readonly searches: WebsetSearchesService;
  readonly enrichments: WebsetEnrichmentsService;
  readonly monitors: WebsetMonitorsService;
  readonly imports: WebsetImportsService;
  readonly events: WebsetEventsService;
  readonly webhooks: WebsetWebhooksService;
}

// ============================================================================
// Main Service Interface
// ============================================================================

/**
 * Effect-native Exa service interface
 */
export interface ExaService {
  readonly search: {
    (
      query: string
    ): Effect.Effect<
      SearchResponse<{ text: { maxCharacters: 10_000 } }>,
      ExaError
    >;
    (
      query: string,
      options: RegularSearchOptions & { contents: false | null | undefined }
    ): Effect.Effect<SearchResponse<{}>, ExaError>;
    <T extends ContentsOptions>(
      query: string,
      options: RegularSearchOptions & { contents: T }
    ): Effect.Effect<SearchResponse<T>, ExaError>;
    (
      query: string,
      options: RegularSearchOptions
    ): Effect.Effect<SearchResponse<{ text: true }>, ExaError>;
  };

  readonly findSimilar: {
    (
      url: string
    ): Effect.Effect<
      SearchResponse<{ text: { maxCharacters: 10_000 } }>,
      ExaError
    >;
    (
      url: string,
      options: FindSimilarOptions & { contents: false | null | undefined }
    ): Effect.Effect<SearchResponse<{}>, ExaError>;
    <T extends ContentsOptions>(
      url: string,
      options: FindSimilarOptions & { contents: T }
    ): Effect.Effect<SearchResponse<T>, ExaError>;
    (
      url: string,
      options: FindSimilarOptions
    ): Effect.Effect<SearchResponse<{ text: true }>, ExaError>;
  };

  readonly getContents: <T extends ContentsOptions>(
    urls: string | string[] | SearchResult<T>[],
    options?: T
  ) => Effect.Effect<SearchResponse<T>, ExaError>;

  readonly answer: {
    <T>(
      query: string,
      options: AnswerOptionsTyped<ZodSchema<T>>
    ): Effect.Effect<AnswerResponseTyped<T>, ExaError>;
    (
      query: string,
      options?: AnswerOptions
    ): Effect.Effect<AnswerResponse, ExaError>;
  };

  readonly streamAnswer: (
    query: string,
    options?: {
      text?: boolean;
      model?: "exa" | "exa-pro";
      systemPrompt?: string;
      outputSchema?: Record<string, unknown>;
      userLocation?: string;
    }
  ) => Stream.Stream<AnswerStreamChunk, ExaError>;

  readonly research: ResearchService;
  readonly websets: WebsetsService;
}

// ============================================================================
// Service Tag
// ============================================================================

/**
 * Effect Context.Tag for the Exa service
 */
export class ExaServiceTag extends Context.Tag("ExaService")<
  ExaServiceTag,
  ExaService
>() {}

// ============================================================================
// Service Implementation
// ============================================================================

const buildResearchService = (client: Exa): ResearchService => ({
  create: ((params: any) =>
    tryPromiseExa(() => client.research.create(params))) as ResearchService["create"],

  get: ((researchId: string, options?: any) =>
    tryPromiseExa(() =>
      client.research.get(researchId, options)
    )) as ResearchService["get"],

  stream: (researchId, options) =>
    streamFromAsyncGenerator(async function* () {
      const generator = await client.research.get(researchId, {
        stream: true,
        ...options,
      });
      yield* generator;
    }),

  list: (options) => tryPromiseExa(() => client.research.list(options)),

  pollUntilFinished: ((researchId: string, options?: any) =>
    tryPromiseExa(() =>
      client.research.pollUntilFinished(researchId, options)
    )) as ResearchService["pollUntilFinished"],
});

const buildWebsetItemsService = (client: Exa): WebsetItemsService => ({
  get: (websetId, itemId) =>
    tryPromiseExa(() => client.websets.items.get(websetId, itemId)),
  list: (websetId, options) =>
    tryPromiseExa(() => client.websets.items.list(websetId, options)),
  listAll: (websetId, options) =>
    streamFromAsyncGenerator(() => client.websets.items.listAll(websetId, options)),
  getAll: (websetId, options) =>
    tryPromiseExa(() => client.websets.items.getAll(websetId, options)),
  delete: (websetId, itemId) =>
    tryPromiseExa(() => client.websets.items.delete(websetId, itemId)),
});

const buildWebsetSearchesService = (client: Exa): WebsetSearchesService => ({
  create: (websetId, params, options) =>
    tryPromiseExa(() => client.websets.searches.create(websetId, params, options)),
  get: (websetId, searchId) =>
    tryPromiseExa(() => client.websets.searches.get(websetId, searchId)),
  cancel: (websetId, searchId) =>
    tryPromiseExa(() => client.websets.searches.cancel(websetId, searchId)),
});

const buildWebsetEnrichmentsService = (
  client: Exa
): WebsetEnrichmentsService => ({
  create: (websetId, params) =>
    tryPromiseExa(() => client.websets.enrichments.create(websetId, params)),
  get: (websetId, enrichmentId) =>
    tryPromiseExa(() => client.websets.enrichments.get(websetId, enrichmentId)),
  update: (websetId, enrichmentId, params) =>
    tryPromiseExa(() =>
      client.websets.enrichments.update(websetId, enrichmentId, params)
    ),
  delete: (websetId, enrichmentId) =>
    tryPromiseExa(() =>
      client.websets.enrichments.delete(websetId, enrichmentId)
    ),
  cancel: (websetId, enrichmentId) =>
    tryPromiseExa(() =>
      client.websets.enrichments.cancel(websetId, enrichmentId)
    ),
});

const buildWebsetMonitorRunsService = (
  client: Exa
): WebsetMonitorRunsService => ({
  get: (monitorId, runId) =>
    tryPromiseExa(() => client.websets.monitors.runs.get(monitorId, runId)),
  list: (monitorId, options) =>
    tryPromiseExa(() => client.websets.monitors.runs.list(monitorId, options)),
});

const buildWebsetMonitorsService = (client: Exa): WebsetMonitorsService => ({
  create: (params) =>
    tryPromiseExa(() => client.websets.monitors.create(params)),
  get: (monitorId) =>
    tryPromiseExa(() => client.websets.monitors.get(monitorId)),
  list: (options) =>
    tryPromiseExa(() => client.websets.monitors.list(options)),
  update: (monitorId, params) =>
    tryPromiseExa(() => client.websets.monitors.update(monitorId, params)),
  delete: (monitorId) =>
    tryPromiseExa(() => client.websets.monitors.delete(monitorId)),
  listAll: (options) =>
    streamFromAsyncGenerator(() => client.websets.monitors.listAll(options)),
  getAll: (options) =>
    tryPromiseExa(() => client.websets.monitors.getAll(options)),
  runs: buildWebsetMonitorRunsService(client),
});

const buildWebsetImportsService = (client: Exa): WebsetImportsService => ({
  create: ((params: any, csv?: CsvDataInput) =>
    csv
      ? tryPromiseExa(() => client.websets.imports.create(params, csv))
      : tryPromiseExa(() =>
          client.websets.imports.create(params)
        )) as WebsetImportsService["create"],
  get: (importId) =>
    tryPromiseExa(() => client.websets.imports.get(importId)),
  list: (options) =>
    tryPromiseExa(() => client.websets.imports.list(options)),
  update: (importId, params) =>
    tryPromiseExa(() => client.websets.imports.update(importId, params)),
  delete: (importId) =>
    tryPromiseExa(() => client.websets.imports.delete(importId)),
  waitUntilCompleted: (importId, options) =>
    tryPromiseExa(() =>
      client.websets.imports.waitUntilCompleted(importId, options)
    ),
  listAll: (options) =>
    streamFromAsyncGenerator(() => client.websets.imports.listAll(options)),
  getAll: (options) =>
    tryPromiseExa(() => client.websets.imports.getAll(options)),
});

const buildWebsetEventsService = (client: Exa): WebsetEventsService => ({
  get: (eventId) => tryPromiseExa(() => client.websets.events.get(eventId)),
  list: (options) =>
    tryPromiseExa(() => client.websets.events.list(options)),
  listAll: (options) =>
    streamFromAsyncGenerator(() => client.websets.events.listAll(options)),
  getAll: (options) =>
    tryPromiseExa(() => client.websets.events.getAll(options)),
});

const buildWebsetWebhooksService = (client: Exa): WebsetWebhooksService => ({
  create: (params) =>
    tryPromiseExa(() => client.websets.webhooks.create(params)),
  get: (webhookId) =>
    tryPromiseExa(() => client.websets.webhooks.get(webhookId)),
  list: (options) =>
    tryPromiseExa(() => client.websets.webhooks.list(options)),
  update: (webhookId, params) =>
    tryPromiseExa(() => client.websets.webhooks.update(webhookId, params)),
  delete: (webhookId) =>
    tryPromiseExa(() => client.websets.webhooks.delete(webhookId)),
  listAll: (options) =>
    streamFromAsyncGenerator(() => client.websets.webhooks.listAll(options)),
  getAll: (options) =>
    tryPromiseExa(() => client.websets.webhooks.getAll(options)),
});

const buildWebsetsService = (client: Exa): WebsetsService => ({
  create: (params, options) =>
    tryPromiseExa(() => client.websets.create(params, options)),
  preview: (params, options) =>
    tryPromiseExa(() => client.websets.preview(params, options)),
  get: (id, expand) => tryPromiseExa(() => client.websets.get(id, expand)),
  list: (options) => tryPromiseExa(() => client.websets.list(options)),
  listAll: (options) =>
    streamFromAsyncGenerator(() => client.websets.listAll(options)),
  getAll: (options) => tryPromiseExa(() => client.websets.getAll(options)),
  update: (id, params) => tryPromiseExa(() => client.websets.update(id, params)),
  delete: (id) => tryPromiseExa(() => client.websets.delete(id)),
  cancel: (id) => tryPromiseExa(() => client.websets.cancel(id)),
  waitUntilIdle: (id, options) =>
    tryPromiseExa(() => client.websets.waitUntilIdle(id, options)),

  items: buildWebsetItemsService(client),
  searches: buildWebsetSearchesService(client),
  enrichments: buildWebsetEnrichmentsService(client),
  monitors: buildWebsetMonitorsService(client),
  imports: buildWebsetImportsService(client),
  events: buildWebsetEventsService(client),
  webhooks: buildWebsetWebhooksService(client),
});

const buildExaService = (client: Exa): ExaService => ({
  search: ((query: string, options?: any) =>
    tryPromiseExa(() => client.search(query, options))) as ExaService["search"],

  findSimilar: ((url: string, options?: any) =>
    tryPromiseExa(() =>
      client.findSimilar(url, options)
    )) as ExaService["findSimilar"],

  getContents: (urls, options) =>
    tryPromiseExa(() => client.getContents(urls as any, options)),

  answer: ((query: string, options?: any) =>
    tryPromiseExa(() => client.answer(query, options))) as ExaService["answer"],

  streamAnswer: (query, options) =>
    streamFromAsyncGenerator(() => client.streamAnswer(query, options)),

  research: buildResearchService(client),
  websets: buildWebsetsService(client),
});

// ============================================================================
// Layer & Factory
// ============================================================================

/**
 * Create an ExaService Effect from configuration
 */
export const makeExaService = (
  config: ExaConfig = {}
): Effect.Effect<ExaService, ExaError> =>
  Effect.try({
    try: () => {
      const client = config.client ?? new Exa(config.apiKey, config.baseURL);
      return buildExaService(client);
    },
    catch: toExaError,
  });

/**
 * Create a Layer that provides ExaService
 */
export const ExaLayer = (config: ExaConfig = {}): Layer.Layer<ExaServiceTag, ExaError> =>
  Layer.effect(ExaServiceTag, makeExaService(config));

/**
 * Convenience namespace for creating Effect-wrapped Exa clients
 */
export const ExaEffect = {
  /**
   * Create an ExaService from an API key
   */
  make: (apiKey: string, baseURL?: string) =>
    makeExaService({ apiKey, baseURL }),

  /**
   * Create an ExaService from an existing Exa client
   */
  fromClient: (client: Exa) => makeExaService({ client }),

  /**
   * Create a Layer from configuration
   */
  layer: ExaLayer,

  /**
   * The service tag for dependency injection
   */
  Tag: ExaServiceTag,
};
