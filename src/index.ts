import { Exa } from "./client";

// Re-export all types from types.ts for public API
export {
  ContentsOptions,
  BaseSearchOptions,
  DeepContentsOptions,
  DeepSearchOptions,
  NonDeepSearchOptions,
  RegularSearchOptions,
  FindSimilarOptions,
  ExtrasOptions,
  LivecrawlOptions,
  VerbosityOptions,
  SectionTag,
  TextContentsOptions,
  HighlightsContentsOptions,
  SummaryContentsOptions,
  JSONSchema,
  ContextOptions,
  TextResponse,
  HighlightsResponse,
  SummaryResponse,
  ExtrasResponse,
  SubpagesResponse,
  Default,
  ContentsResultComponent,
  CostDollarsContents,
  CostDollarsSeearch,
  CostDollars,
  EntityCompanyPropertiesWorkforce,
  EntityCompanyPropertiesHeadquarters,
  EntityCompanyPropertiesFundingRound,
  EntityCompanyPropertiesFinancials,
  EntityCompanyPropertiesWebTraffic,
  EntityCompanyProperties,
  EntityDateRange,
  EntityPersonPropertiesCompanyRef,
  EntityPersonPropertiesWorkHistoryEntry,
  EntityPersonProperties,
  SearchCompanyEntity,
  SearchPersonEntity,
  SearchEntity,
  CompanyEntity,
  PersonEntity,
  Entity,
  SearchResult,
  SearchResponse,
  Status,
  AnswerOptions,
  AnswerResponse,
  AnswerStreamChunk,
  AnswerStreamResponse,
  AnswerOptionsTyped,
  AnswerResponseTyped,
  SummaryContentsOptionsTyped,
} from "./types";

// Re-export Effect wrapper
export * from "./effect";

// Re-export Websets related types and enums
export * from "./websets";
// Re-export Research related types and client
export * from "./research";

// Export the main class
export { Exa };
export default Exa;

// Re-export errors
export * from "./errors";
