import { ZodSchema } from "zod";

/**
 * Options for retrieving page contents
 * @typedef {Object} ContentsOptions
 * @property {TextContentsOptions | boolean} [text] - Options for retrieving text contents.
 * @property {HighlightsContentsOptions | boolean} [highlights] - Options for retrieving highlights. NOTE: For search type "deep", only "true" is allowed. "query", "maxCharacters", "numSentences" and "highlightsPerUrl" will not be respected.
 * @property {SummaryContentsOptions | boolean} [summary] - Options for retrieving summary.
 * @property {number} [maxAgeHours] - Maximum age of cached content in hours. If content is older, it will be fetched fresh. Special values: 0 = always fetch fresh content, -1 = never fetch fresh (use cached content only). Example: 168 = fetch fresh for pages older than 7 days.
 * @property {boolean} [filterEmptyResults] - If true, filters out results with no contents. Default is true.
 * @property {number} [subpages] - The number of subpages to return for each result, where each subpage is derived from an internal link for the result.
 * @property {string | string[]} [subpageTarget] - Text used to match/rank subpages in the returned subpage list. You could use "about" to get *about* page for websites. Note that this is a fuzzy matcher.
 * @property {ExtrasOptions} [extras] - Miscelleneous data derived from results
 */
export type ContentsOptions = {
  text?: TextContentsOptions | true;
  highlights?: HighlightsContentsOptions | true;
  summary?: SummaryContentsOptions | true;
  livecrawl?: LivecrawlOptions;
  context?: ContextOptions | true;
  livecrawlTimeout?: number;
  maxAgeHours?: number;
  filterEmptyResults?: boolean;
  subpages?: number;
  subpageTarget?: string | string[];
  extras?: ExtrasOptions;
};

/**
 * Options for performing a search query
 * @typedef {Object} SearchOptions
 * @property {ContentsOptions | boolean} [contents] - Options for retrieving page contents for each result returned. Default is { text: { maxCharacters: 10_000 } }.
 * @property {number} [numResults] - Number of search results to return. Default 10. Max 10 for basic plans. For deep search, recommend leaving blank - number of results will be determined dynamically for your query.
 * @property {string[]} [includeDomains] - List of domains to include in the search.
 * @property {string[]} [excludeDomains] - List of domains to exclude in the search.
 * @property {string} [startCrawlDate] - Start date for results based on crawl date.
 * @property {string} [endCrawlDate] - End date for results based on crawl date.
 * @property {string} [startPublishedDate] - Start date for results based on published date.
 * @property {string} [endPublishedDate] - End date for results based on published date.
 * @property {string} [category] - A data category to focus on, with higher comprehensivity and data cleanliness.
 * @property {string[]} [includeText] - List of strings that must be present in webpage text of results. Currently only supports 1 string of up to 5 words.
 * @property {string[]} [excludeText] - List of strings that must not be present in webpage text of results. Currently only supports 1 string of up to 5 words.
 * @property {string[]} [flags] - Experimental flags
 * @property {string} [userLocation] - The two-letter ISO country code of the user, e.g. US.
 */
export type BaseSearchOptions = {
  contents?: ContentsOptions;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startCrawlDate?: string;
  endCrawlDate?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
  category?:
    | "company"
    | "research paper"
    | "news"
    | "pdf"
    | "tweet"
    | "personal site"
    | "financial report"
    | "people";
  includeText?: string[];
  excludeText?: string[];
  flags?: string[];
  userLocation?: string;
};

/**
 * Base search options shared across all search types
 */
type BaseRegularSearchOptions = BaseSearchOptions & {
  /**
   * If true, the search results are moderated for safety.
   */
  moderation?: boolean;
  useAutoprompt?: boolean;
};

/**
 * Contents options for deep search - context is always returned and cannot be disabled
 */
export type DeepContentsOptions = Omit<ContentsOptions, "context"> & {
  context?: Omit<ContextOptions, never> | true;
};

/**
 * Search options for deep search type, which supports additional queries.
 * Note: context is always returned by the API for deep search and cannot be set to false.
 */
export type DeepSearchOptions = Omit<BaseRegularSearchOptions, "contents"> & {
  type: "deep";
  /**
   * Alternative query formulations for deep search to skip automatic LLM-based query expansion.
   * Max 5 queries.
   * @example ["machine learning", "ML algorithms", "neural networks"]
   */
  additionalQueries?: string[];
  /**
   * Options for retrieving page contents. For deep search, context is always returned.
   */
  contents?: DeepContentsOptions;
};

/**
 * Search options for non-deep search types (keyword, neural, auto, hybrid, fast)
 */
export type NonDeepSearchOptions = BaseRegularSearchOptions & {
  type?: "keyword" | "neural" | "auto" | "hybrid" | "fast";
};

/**
 * Search options for performing a search query.
 * Uses a discriminated union to ensure additionalQueries is only allowed when type is "deep".
 */
export type RegularSearchOptions = DeepSearchOptions | NonDeepSearchOptions;

/**
 * Options for finding similar links.
 * @typedef {Object} FindSimilarOptions
 * @property {boolean} [excludeSourceDomain] - If true, excludes links from the base domain of the input.
 */
export type FindSimilarOptions = BaseSearchOptions & {
  excludeSourceDomain?: boolean;
};

export type ExtrasOptions = { links?: number; imageLinks?: number };

/**
 * Options for livecrawling contents
 * @typedef {string} LivecrawlOptions
 */
export type LivecrawlOptions =
  | "never"
  | "fallback"
  | "always"
  | "auto"
  | "preferred";

/**
 * Verbosity levels for content filtering.
 * - compact: Most concise output, main content only (default)
 * - standard: Balanced content with more detail
 * - full: Complete content including all sections
 */
export type VerbosityOptions = "compact" | "standard" | "full";

/**
 * Section tags for semantic content filtering.
 */
export type SectionTag =
  | "unspecified"
  | "header"
  | "navigation"
  | "banner"
  | "body"
  | "sidebar"
  | "footer"
  | "metadata";

/**
 * Options for retrieving text from page.
 * @typedef {Object} TextContentsOptions
 * @property {number} [maxCharacters] - The maximum number of characters to return.
 * @property {boolean} [includeHtmlTags] - If true, includes HTML tags in the returned text. Default: false
 * @property {VerbosityOptions} [verbosity] - Controls verbosity level of returned content. Default: "compact". Requires maxAgeHours: 0.
 * @property {SectionTag[]} [includeSections] - Only include content from these semantic sections. Requires maxAgeHours: 0.
 * @property {SectionTag[]} [excludeSections] - Exclude content from these semantic sections. Requires maxAgeHours: 0.
 */
export type TextContentsOptions = {
  maxCharacters?: number;
  includeHtmlTags?: boolean;
  verbosity?: VerbosityOptions;
  includeSections?: SectionTag[];
  excludeSections?: SectionTag[];
};

/**
 * Options for retrieving highlights from page.
 * NOTE: For search type "deep", these options will not be respected. Highlights will be generated with respect
 * to your initial query, and may vary in quantity and length.
 * @typedef {Object} HighlightsContentsOptions
 * @property {string} [query] - The query string to use for highlights search.
 * @property {number} [maxCharacters] - The maximum number of characters to return for highlights.
 * @property {number} [numSentences] - Deprecated. Use maxCharacters instead.
 * @property {number} [highlightsPerUrl] - Deprecated. Use maxCharacters instead.
 */
export type HighlightsContentsOptions = {
  query?: string;
  maxCharacters?: number;
  /** @deprecated Use maxCharacters instead */
  numSentences?: number;
  /** @deprecated Use maxCharacters instead */
  highlightsPerUrl?: number;
};
/**
 * Options for retrieving summary from page.
 * @typedef {Object} SummaryContentsOptions
 * @property {string} [query] - The query string to use for summary generation.
 * @property {JSONSchema} [schema] - JSON schema for structured output from summary.
 */
export type SummaryContentsOptions = {
  query?: string;
  schema?: Record<string, unknown> | ZodSchema;
};

/**
 * @deprecated Use Record<string, unknown> instead.
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Options for retrieving the context from a list of search results. The context is a string
 * representation of all the search results.
 * @typedef {Object} ContextOptions
 * @property {number} [maxCharacters] - The maximum number of characters.
 */
export type ContextOptions = {
  maxCharacters?: number;
};

/**
 * @typedef {Object} TextResponse
 * @property {string} text - Text from page
 */
export type TextResponse = { text: string };

/**
 * @typedef {Object} HighlightsResponse
 * @property {string[]} highlights - The highlights as an array of strings.
 * @property {number[]} [highlightScores] - The corresponding scores as an array of floats, 0 to 1
 */
export type HighlightsResponse = {
  highlights: string[];
  highlightScores?: number[];
};

/**
 * @typedef {Object} SummaryResponse
 * @property {string} summary - The generated summary of the page content.
 */
export type SummaryResponse = { summary: string };

/**
 * @typedef {Object} ExtrasResponse
 * @property {string[]} links - The links on the page of a result
 * @property {string[]} imageLinks - The image links on the page of a result
 */
export type ExtrasResponse = {
  extras: { links?: string[]; imageLinks?: string[] };
};

/**
 * @typedef {Object} SubpagesResponse
 * @property {ContentsResultComponent<T extends ContentsOptions>} subpages - The subpages for a result
 */
export type SubpagesResponse<T extends ContentsOptions> = {
  subpages: ContentsResultComponent<T>[];
};

export type Default<T extends {}, U> = [keyof T] extends [never] ? U : T;

/**
 * @typedef {Object} ContentsResultComponent
 * Depending on 'ContentsOptions', this yields a combination of 'TextResponse', 'HighlightsResponse', 'SummaryResponse', or an empty object.
 *
 * @template T - A type extending from 'ContentsOptions'.
 */
export type ContentsResultComponent<T extends ContentsOptions> =
  (T["text"] extends object | true ? TextResponse : {}) &
    (T["highlights"] extends object | true ? HighlightsResponse : {}) &
    (T["summary"] extends object | true ? SummaryResponse : {}) &
    (T["subpages"] extends number ? SubpagesResponse<T> : {}) &
    (T["extras"] extends object ? ExtrasResponse : {});

/**
 * Represents the cost breakdown related to contents retrieval. Fields are optional because
 * only non-zero costs are included.
 * @typedef {Object} CostDollarsContents
 * @property {number} [text] - The cost in dollars for retrieving text.
 * @property {number} [highlights] - The cost in dollars for retrieving highlights.
 * @property {number} [summary] - The cost in dollars for retrieving summary.
 */
export type CostDollarsContents = {
  text?: number;
  highlights?: number;
  summary?: number;
};

/**
 * Represents the cost breakdown related to search. Fields are optional because
 * only non-zero costs are included.
 * @typedef {Object} CostDollarsSeearch
 * @property {number} [neural] - The cost in dollars for neural search.
 * @property {number} [keyword] - The cost in dollars for keyword search.
 */
export type CostDollarsSeearch = {
  neural?: number;
  keyword?: number;
};

/**
 * Represents the total cost breakdown. Only non-zero costs are included.
 * @typedef {Object} CostDollars
 * @property {number} total - The total cost in dollars.
 * @property {CostDollarsSeearch} [search] - The cost breakdown for search.
 * @property {CostDollarsContents} [contents] - The cost breakdown for contents.
 */
export type CostDollars = {
  total: number;
  search?: CostDollarsSeearch;
  contents?: CostDollarsContents;
};

/**
 * Entity types for company/people search results.
 * Only returned when using category=company or category=people searches.
 */

/** Company workforce information. */
export type EntityCompanyPropertiesWorkforce = {
  total?: number | null;
};

/** Company headquarters information. */
export type EntityCompanyPropertiesHeadquarters = {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

/** Funding round information. */
export type EntityCompanyPropertiesFundingRound = {
  name?: string | null;
  date?: string | null;
  amount?: number | null;
};

/** Company financial information. */
export type EntityCompanyPropertiesFinancials = {
  revenueAnnual?: number | null;
  fundingTotal?: number | null;
  fundingLatestRound?: EntityCompanyPropertiesFundingRound | null;
};

/** Company web traffic information. */
export type EntityCompanyPropertiesWebTraffic = {
  visitsMonthly?: number | null;
};

/** Structured properties for a company entity. */
export type EntityCompanyProperties = {
  name?: string | null;
  foundedYear?: number | null;
  description?: string | null;
  workforce?: EntityCompanyPropertiesWorkforce | null;
  headquarters?: EntityCompanyPropertiesHeadquarters | null;
  financials?: EntityCompanyPropertiesFinancials | null;
  webTraffic?: EntityCompanyPropertiesWebTraffic | null;
};

/** Date range for work history entries. */
export type EntityDateRange = {
  from?: string | null;
  to?: string | null;
};

/** Reference to a company in work history. */
export type EntityPersonPropertiesCompanyRef = {
  id?: string | null;
  name?: string | null;
};

/** A single work history entry for a person. */
export type EntityPersonPropertiesWorkHistoryEntry = {
  title?: string | null;
  location?: string | null;
  dates?: EntityDateRange | null;
  company?: EntityPersonPropertiesCompanyRef | null;
};

/** Structured properties for a person entity. */
export type EntityPersonProperties = {
  name?: string | null;
  location?: string | null;
  workHistory?: EntityPersonPropertiesWorkHistoryEntry[];
};

/** Structured entity data for a company in search results. */
export type SearchCompanyEntity = {
  id: string;
  type: "company";
  version: number;
  properties: EntityCompanyProperties;
};

/** Structured entity data for a person in search results. */
export type SearchPersonEntity = {
  id: string;
  type: "person";
  version: number;
  properties: EntityPersonProperties;
};

/** Structured entity data for company or person search results. */
export type SearchEntity = SearchCompanyEntity | SearchPersonEntity;

/** @deprecated Use SearchCompanyEntity instead */
export type CompanyEntity = SearchCompanyEntity;
/** @deprecated Use SearchPersonEntity instead */
export type PersonEntity = SearchPersonEntity;
/** @deprecated Use SearchEntity instead */
export type Entity = SearchEntity;

/**
 * Represents a search result object.
 * @typedef {Object} SearchResult
 * @property {string} title - The title of the search result.
 * @property {string} url - The URL of the search result.
 * @property {string} [publishedDate] - The estimated creation date of the content.
 * @property {string} [author] - The author of the content, if available.
 * @property {number} [score] - Similarity score between the query/url and the result.
 * @property {string} id - The temporary ID for the document.
 * @property {string} [image] - A representative image for the content, if any.
 * @property {string} [favicon] - A favicon for the site, if any.
 * @property {Entity[]} [entities] - Structured entity data for company or person search results.
 */
export type SearchResult<T extends ContentsOptions> = {
  title: string | null;
  url: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  id: string;
  image?: string;
  favicon?: string;
  entities?: SearchEntity[];
} & ContentsResultComponent<T>;

/**
 * Represents a search response object.
 * @typedef {Object} SearchResponse
 * @property {Result[]} results - The list of search results.
 * @property {string} [context] - The context for the search.
 * @property {string} [autoDate] - The autoprompt date, if applicable.
 * @property {string} requestId - The request ID for the search.
 * @property {CostDollars} [costDollars] - The cost breakdown for this request.
 * @property {string} [resolvedSearchType] - The resolved search type ('neural' or 'keyword') when using 'auto' search.
 * @property {number} [searchTime] - Time taken for the search in milliseconds.
 */
export type SearchResponse<T extends ContentsOptions> = {
  results: SearchResult<T>[];
  context?: string;
  autoDate?: string;
  requestId: string;
  statuses?: Array<Status>;
  costDollars?: CostDollars;
  resolvedSearchType?: string;
  searchTime?: number;
};

export type Status = {
  id: string;
  status: string;
  source: string;
};

/**
 * Options for the answer endpoint
 * @typedef {Object} AnswerOptions
 * @property {boolean} [stream] - Whether to stream the response. Default false.
 * @property {boolean} [text] - Whether to include text in the source results. Default false.
 * @property {"exa"} [model] - The model to use for generating the answer. Default "exa".
 * @property {string} [systemPrompt] - A system prompt to guide the LLM's behavior when generating the answer.
 * @property {Object} [outputSchema] - A JSON Schema specification for the structure you expect the output to take
 */
export type AnswerOptions = {
  stream?: boolean;
  text?: boolean;
  model?: "exa";
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
  userLocation?: string;
};

/**
 * Represents an answer response object from the /answer endpoint.
 * @typedef {Object} AnswerResponse
 * @property {string | Object} answer - The generated answer text (or an object matching `outputSchema`, if provided)
 * @property {SearchResult<{}>[]} citations - The sources used to generate the answer.
 * @property {CostDollars} [costDollars] - The cost breakdown for this request.
 * @property {string} [requestId] - Optional request ID for the answer.
 */
export type AnswerResponse = {
  answer: string | Record<string, unknown>;
  citations: SearchResult<{}>[];
  requestId?: string;
  costDollars?: CostDollars;
};

export type AnswerStreamChunk = {
  /**
   * The partial text content of the answer (if present in this chunk).
   */
  content?: string;
  /**
   * Citations associated with the current chunk of text (if present).
   */
  citations?: Array<{
    id: string;
    url: string;
    title?: string;
    publishedDate?: string;
    author?: string;
    text?: string;
  }>;
};

/**
 * Represents a streaming answer response chunk from the /answer endpoint.
 * @typedef {Object} AnswerStreamResponse
 * @property {string} [answer] - A chunk of the generated answer text.
 * @property {SearchResult<{}>[]]} [citations] - The sources used to generate the answer.
 */
export type AnswerStreamResponse = {
  answer?: string;
  citations?: SearchResult<{}>[];
};

// ==========================================
// Zod-Enhanced Types
// ==========================================

/**
 * Enhanced answer options that accepts either JSON schema or Zod schema
 */
export type AnswerOptionsTyped<T> = Omit<AnswerOptions, "outputSchema"> & {
  outputSchema: T;
};

/**
 * Enhanced answer response with strongly typed answer when using Zod
 */
export type AnswerResponseTyped<T> = Omit<AnswerResponse, "answer"> & {
  answer: T;
};

/**
 * Enhanced summary contents options that accepts either JSON schema or Zod schema
 */
export type SummaryContentsOptionsTyped<T> = Omit<
  SummaryContentsOptions,
  "schema"
> & {
  schema: T;
};
