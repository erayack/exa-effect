import fetch, { Headers } from "cross-fetch";
import { ZodSchema } from "zod";
import packageJson from "../package.json";
import { ExaError, HttpStatusCode } from "./errors";
import { ResearchClient } from "./research/client";
import { WebsetsClient } from "./websets/client";
import { isZodSchema, zodToJsonSchema } from "./zod-utils";
import type {
  ContentsOptions,
  SearchResponse,
  SearchResult,
  RegularSearchOptions,
  FindSimilarOptions,
  AnswerOptions,
  AnswerOptionsTyped,
  AnswerResponse,
  AnswerResponseTyped,
  AnswerStreamChunk,
  DeepSearchOptions,
  NonDeepSearchOptions,
} from "./types";

// Use native fetch in Node.js environments
const fetchImpl =
  typeof global !== "undefined" && global.fetch ? global.fetch : fetch;
const HeadersImpl =
  typeof global !== "undefined" && global.Headers ? global.Headers : Headers;

const DEFAULT_MAX_CHARACTERS = 10_000;

/**
 * The Exa class encapsulates the API's endpoints.
 */
export class Exa {
  private baseURL: string;
  private headers: Headers;

  /**
   * Websets API client
   */
  websets: WebsetsClient;

  /**
   * Research API client
   */
  research: ResearchClient;

  /**
   * Helper method to separate out the contents-specific options from the rest.
   */
  private extractContentsOptions<T extends ContentsOptions>(
    options: T
  ): {
    contentsOptions: ContentsOptions;
    restOptions: Omit<T, keyof ContentsOptions>;
  } {
    const {
      text,
      highlights,
      summary,
      subpages,
      subpageTarget,
      extras,
      livecrawl,
      livecrawlTimeout,
      maxAgeHours,
      context,
      ...rest
    } = options;

    const contentsOptions: ContentsOptions = {};

    // Default: if none of text, summary, or highlights is provided, we retrieve text
    if (
      text === undefined &&
      summary === undefined &&
      highlights === undefined &&
      extras === undefined
    ) {
      contentsOptions.text = true;
    }

    if (text !== undefined) contentsOptions.text = text;
    if (highlights !== undefined) contentsOptions.highlights = highlights;
    if (summary !== undefined) {
      // Handle zod schema conversion for summary
      if (
        typeof summary === "object" &&
        summary !== null &&
        "schema" in summary &&
        summary.schema &&
        isZodSchema(summary.schema)
      ) {
        contentsOptions.summary = {
          ...summary,
          schema: zodToJsonSchema(summary.schema),
        };
      } else {
        contentsOptions.summary = summary;
      }
    }
    if (subpages !== undefined) contentsOptions.subpages = subpages;
    if (subpageTarget !== undefined)
      contentsOptions.subpageTarget = subpageTarget;
    if (extras !== undefined) contentsOptions.extras = extras;
    if (livecrawl !== undefined) contentsOptions.livecrawl = livecrawl;
    if (livecrawlTimeout !== undefined)
      contentsOptions.livecrawlTimeout = livecrawlTimeout;
    if (maxAgeHours !== undefined) contentsOptions.maxAgeHours = maxAgeHours;
    if (context !== undefined) contentsOptions.context = context;

    return {
      contentsOptions,
      restOptions: rest as Omit<T, keyof ContentsOptions>,
    };
  }

  /**
   * Constructs the Exa API client.
   * @param {string} apiKey - The API key for authentication.
   * @param {string} [baseURL] - The base URL of the Exa API.
   */
  constructor(apiKey?: string, baseURL: string = "https://api.exa.ai") {
    this.baseURL = baseURL;
    if (!apiKey) {
      apiKey = process.env.EXA_API_KEY;
      if (!apiKey) {
        throw new ExaError(
          "API key must be provided as an argument or as an environment variable (EXA_API_KEY)",
          HttpStatusCode.Unauthorized
        );
      }
    }
    this.headers = new HeadersImpl({
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "User-Agent": `exa-effect ${packageJson.version}`,
    });

    // Initialize the Websets client
    this.websets = new WebsetsClient(this);
    // Initialize the Research client
    this.research = new ResearchClient(this);
  }

  /**
   * Makes a request to the Exa API.
   * @param {string} endpoint - The API endpoint to call.
   * @param {string} method - The HTTP method to use.
   * @param {any} [body] - The request body for POST requests.
   * @param {Record<string, any>} [params] - The query parameters.
   * @returns {Promise<any>} The response from the API.
   * @throws {ExaError} When any API request fails with structured error information
   */
  async request<T = unknown>(
    endpoint: string,
    method: string,
    body?: any,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T> {
    // Build URL with query parameters if provided
    let url = this.baseURL + endpoint;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            searchParams.append(key, item);
          }
        } else if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      url += `?${searchParams.toString()}`;
    }

    let combinedHeaders: Record<string, string> = {};

    if (this.headers instanceof HeadersImpl) {
      this.headers.forEach((value, key) => {
        combinedHeaders[key] = value;
      });
    } else {
      combinedHeaders = { ...(this.headers as Record<string, string>) };
    }

    if (headers) {
      combinedHeaders = { ...combinedHeaders, ...headers };
    }

    const response = await fetchImpl(url, {
      method,
      headers: combinedHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json();

      if (!errorData.statusCode) {
        errorData.statusCode = response.status;
      }
      if (!errorData.timestamp) {
        errorData.timestamp = new Date().toISOString();
      }
      if (!errorData.path) {
        errorData.path = endpoint;
      }

      // For other APIs, throw a simple ExaError with just message and status
      let message = errorData.error || "Unknown error";
      if (errorData.message) {
        message += (message.length > 0 ? ". " : "") + errorData.message;
      }
      throw new ExaError(
        message,
        response.status,
        errorData.timestamp,
        errorData.path
      );
    }

    // If the server responded with an SSE stream, parse it and return the final payload.
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return (await this.parseSSEStream<T>(response)) as T;
    }

    return (await response.json()) as T;
  }

  async rawRequest(
    endpoint: string,
    method: string = "POST",
    body?: Record<string, unknown>,
    queryParams?: Record<
      string,
      string | number | boolean | string[] | undefined
    >
  ): Promise<Response> {
    let url = this.baseURL + endpoint;

    if (queryParams) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            searchParams.append(key, String(item));
          }
        } else if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      url += `?${searchParams.toString()}`;
    }

    const response = await fetchImpl(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  }

  /**
   * Performs a search with an Exa prompt-engineered query.
   * By default, returns text contents. Use contents: false to opt-out.
   *
   * @param {string} query - The query string.
   * @returns {Promise<SearchResponse<{ text: { maxCharacters: 10_000 } }>>} A list of relevant search results with text contents.
   */
  async search(
    query: string
  ): Promise<SearchResponse<{ text: { maxCharacters: 10_000 } }>>;
  /**
   * Performs a search without contents.
   *
   * @param {string} query - The query string.
   * @param {RegularSearchOptions & { contents: false }} options - Search options with contents explicitly disabled
   * @returns {Promise<SearchResponse<{}>>} A list of relevant search results without contents.
   */
  async search(
    query: string,
    options: RegularSearchOptions & { contents: false | null | undefined }
  ): Promise<SearchResponse<{}>>;
  /**
   * Performs a search with specific contents.
   *
   * @param {string} query - The query string.
   * @param {RegularSearchOptions & { contents: T }} options - Search options with specific contents
   * @returns {Promise<SearchResponse<T>>} A list of relevant search results with requested contents.
   */
  async search<T extends ContentsOptions>(
    query: string,
    options: RegularSearchOptions & { contents: T }
  ): Promise<SearchResponse<T>>;
  /**
   * Performs a search with an Exa prompt-engineered query.
   * When no contents option is specified, returns text contents by default.
   *
   * @param {string} query - The query string.
   * @param {Omit<DeepSearchOptions, 'contents'> | Omit<NonDeepSearchOptions, 'contents'>} options - Search options without contents
   * @returns {Promise<SearchResponse<{ text: true }>>} A list of relevant search results with text contents.
   */
  async search(
    query: string,
    options:
      | Omit<DeepSearchOptions, "contents">
      | Omit<NonDeepSearchOptions, "contents">
  ): Promise<SearchResponse<{ text: true }>>;
  async search<T extends ContentsOptions>(
    query: string,
    options?: RegularSearchOptions & { contents?: T | false | null | undefined }
  ): Promise<SearchResponse<T | { text: true } | {}>> {
    if (options === undefined || !("contents" in options)) {
      return await this.request("/search", "POST", {
        query,
        ...options,
        contents: { text: { maxCharacters: DEFAULT_MAX_CHARACTERS } },
      });
    }

    // If contents is false, null, or undefined, don't send it to the API
    if (
      options.contents === false ||
      options.contents === null ||
      options.contents === undefined
    ) {
      const { contents, ...restOptions } = options;
      return await this.request("/search", "POST", { query, ...restOptions });
    }

    return await this.request("/search", "POST", { query, ...options });
  }

  /**
   * @deprecated Use `search()` instead. The search method now returns text contents by default.
   *
   * Migration examples:
   * - `searchAndContents(query)` → `search(query)`
   * - `searchAndContents(query, { text: true })` → `search(query, { contents: { text: true } })`
   * - `searchAndContents(query, { summary: true })` → `search(query, { contents: { summary: true } })`
   *
   * Performs a search with an Exa prompt-engineered query and returns the contents of the documents.
   *
   * @param {string} query - The query string.
   * @param {RegularSearchOptions & T} [options] - Additional search + contents options
   * @returns {Promise<SearchResponse<T>>} A list of relevant search results with requested contents.
   */
  async searchAndContents<T extends ContentsOptions>(
    query: string,
    options?: RegularSearchOptions & T
  ): Promise<SearchResponse<T>> {
    const { contentsOptions, restOptions } =
      options === undefined
        ? {
            contentsOptions: {
              text: { maxCharacters: DEFAULT_MAX_CHARACTERS },
            },
            restOptions: {},
          }
        : this.extractContentsOptions(options);

    return await this.request("/search", "POST", {
      query,
      contents: contentsOptions,
      ...restOptions,
    });
  }

  /**
   * Finds similar links to the provided URL.
   * By default, returns text contents. Use contents: false to opt-out.
   *
   * @param {string} url - The URL for which to find similar links.
   * @returns {Promise<SearchResponse<{ text: { maxCharacters: 10_000 } }>>} A list of similar search results with text contents.
   */
  async findSimilar(
    url: string
  ): Promise<SearchResponse<{ text: { maxCharacters: 10_000 } }>>;
  /**
   * Finds similar links to the provided URL without contents.
   *
   * @param {string} url - The URL for which to find similar links.
   * @param {FindSimilarOptions & { contents: false }} options - Options with contents explicitly disabled
   * @returns {Promise<SearchResponse<{}>>} A list of similar search results without contents.
   */
  async findSimilar(
    url: string,
    options: FindSimilarOptions & { contents: false | null | undefined }
  ): Promise<SearchResponse<{}>>;
  /**
   * Finds similar links to the provided URL with specific contents.
   *
   * @param {string} url - The URL for which to find similar links.
   * @param {FindSimilarOptions & { contents: T }} options - Options with specific contents
   * @returns {Promise<SearchResponse<T>>} A list of similar search results with requested contents.
   */
  async findSimilar<T extends ContentsOptions>(
    url: string,
    options: FindSimilarOptions & { contents: T }
  ): Promise<SearchResponse<T>>;
  /**
   * Finds similar links to the provided URL.
   * When no contents option is specified, returns text contents by default.
   *
   * @param {string} url - The URL for which to find similar links.
   * @param {Omit<FindSimilarOptions, 'contents'>} options - Options without contents
   * @returns {Promise<SearchResponse<{ text: true }>>} A list of similar search results with text contents.
   */
  async findSimilar(
    url: string,
    options: Omit<FindSimilarOptions, "contents">
  ): Promise<SearchResponse<{ text: true }>>;
  async findSimilar<T extends ContentsOptions>(
    url: string,
    options?: FindSimilarOptions & { contents?: T | false | null | undefined }
  ): Promise<SearchResponse<T | { text: { maxCharacters: 10_000 } } | {}>> {
    if (options === undefined || !("contents" in options)) {
      // No options or no contents property → default to text contents
      return await this.request("/findSimilar", "POST", {
        url,
        ...options,
        contents: { text: { maxCharacters: DEFAULT_MAX_CHARACTERS } },
      });
    }

    // If contents is false, null, or undefined, don't send it to the API
    if (
      options.contents === false ||
      options.contents === null ||
      options.contents === undefined
    ) {
      const { contents, ...restOptions } = options;
      return await this.request("/findSimilar", "POST", {
        url,
        ...restOptions,
      });
    }

    // Contents property exists with value - pass it through
    return await this.request("/findSimilar", "POST", { url, ...options });
  }

  /**
   * @deprecated Use `findSimilar()` instead. The findSimilar method now returns text contents by default.
   *
   * Migration examples:
   * - `findSimilarAndContents(url)` → `findSimilar(url)`
   * - `findSimilarAndContents(url, { text: true })` → `findSimilar(url, { contents: { text: true } })`
   * - `findSimilarAndContents(url, { summary: true })` → `findSimilar(url, { contents: { summary: true } })`
   *
   * Finds similar links to the provided URL and returns the contents of the documents.
   * @param {string} url - The URL for which to find similar links.
   * @param {FindSimilarOptions & T} [options] - Additional options for finding similar links + contents.
   * @returns {Promise<SearchResponse<T>>} A list of similar search results, including requested contents.
   */
  async findSimilarAndContents<T extends ContentsOptions>(
    url: string,
    options?: FindSimilarOptions & T
  ): Promise<SearchResponse<T>> {
    const { contentsOptions, restOptions } =
      options === undefined
        ? {
            contentsOptions: {
              text: { maxCharacters: DEFAULT_MAX_CHARACTERS },
            },
            restOptions: {},
          }
        : this.extractContentsOptions(options);

    return await this.request("/findSimilar", "POST", {
      url,
      contents: contentsOptions,
      ...restOptions,
    });
  }

  /**
   * Retrieves contents of documents based on URLs.
   * @param {string | string[] | SearchResult[]} urls - A URL or array of URLs, or an array of SearchResult objects.
   * @param {ContentsOptions} [options] - Additional options for retrieving document contents.
   * @returns {Promise<SearchResponse<T>>} A list of document contents for the requested URLs.
   */
  async getContents<T extends ContentsOptions>(
    urls: string | string[] | SearchResult<T>[],
    options?: T
  ): Promise<SearchResponse<T>> {
    if (!urls || (Array.isArray(urls) && urls.length === 0)) {
      throw new ExaError(
        "Must provide at least one URL",
        HttpStatusCode.BadRequest
      );
    }

    let requestUrls: string[];

    if (typeof urls === "string") {
      requestUrls = [urls];
    } else if (typeof urls[0] === "string") {
      requestUrls = urls as string[];
    } else {
      requestUrls = (urls as SearchResult<T>[]).map((result) => result.url);
    }

    const payload = {
      urls: requestUrls,
      ...options,
    };

    return await this.request("/contents", "POST", payload);
  }

  /**
   * Generate an answer with Zod schema for strongly typed output
   */
  async answer<T>(
    query: string,
    options: AnswerOptionsTyped<ZodSchema<T>>
  ): Promise<AnswerResponseTyped<T>>;

  /**
   * Generate an answer to a query.
   * @param {string} query - The question or query to answer.
   * @param {AnswerOptions} [options] - Additional options for answer generation.
   * @returns {Promise<AnswerResponse>} The generated answer and source references.
   *
   * Example with systemPrompt:
   * ```ts
   * const answer = await exa.answer("What is quantum computing?", {
   *   text: true,
   *   model: "exa",
   *   systemPrompt: "Answer in a technical manner suitable for experts."
   * });
   * ```
   *
   * Note: For streaming responses, use the `streamAnswer` method:
   * ```ts
   * for await (const chunk of exa.streamAnswer(query)) {
   *   // Handle chunks
   * }
   * ```
   */
  async answer(query: string, options?: AnswerOptions): Promise<AnswerResponse>;

  async answer<T>(
    query: string,
    options?: AnswerOptions | AnswerOptionsTyped<ZodSchema<T>>
  ): Promise<AnswerResponse | AnswerResponseTyped<T>> {
    if (options?.stream) {
      throw new ExaError(
        "For streaming responses, please use streamAnswer() instead:\n\n" +
          "for await (const chunk of exa.streamAnswer(query)) {\n" +
          "  // Handle chunks\n" +
          "}",
        HttpStatusCode.BadRequest
      );
    }

    // For non-streaming requests, make a regular API call
    let outputSchema = options?.outputSchema;

    // Convert Zod schema to JSON schema if needed
    if (outputSchema && isZodSchema(outputSchema)) {
      outputSchema = zodToJsonSchema(outputSchema);
    }

    const requestBody = {
      query,
      stream: false,
      text: options?.text ?? false,
      model: options?.model ?? "exa",
      systemPrompt: options?.systemPrompt,
      outputSchema,
      userLocation: options?.userLocation,
    };

    return await this.request("/answer", "POST", requestBody);
  }

  /**
   * Stream an answer with Zod schema for structured output (non-streaming content)
   * Note: Structured output works only with non-streaming content, not with streaming chunks
   */
  streamAnswer<T>(
    query: string,
    options: {
      text?: boolean;
      model?: "exa" | "exa-pro";
      systemPrompt?: string;
      outputSchema: ZodSchema<T>;
      userLocation?: string;
    }
  ): AsyncGenerator<AnswerStreamChunk>;

  /**
   * Stream an answer as an async generator
   *
   * Each iteration yields a chunk with partial text (`content`) or new citations.
   * Use this if you'd like to read the answer incrementally, e.g. in a chat UI.
   *
   * Example usage:
   * ```ts
   * for await (const chunk of exa.streamAnswer("What is quantum computing?", {
   *   text: false,
   *   systemPrompt: "Answer in a concise manner suitable for beginners."
   * })) {
   *   if (chunk.content) process.stdout.write(chunk.content);
   *   if (chunk.citations) {
   *     console.log("\nCitations: ", chunk.citations);
   *   }
   * }
   * ```
   */
  streamAnswer(
    query: string,
    options?: {
      text?: boolean;
      model?: "exa" | "exa-pro";
      systemPrompt?: string;
      outputSchema?: Record<string, unknown>;
      userLocation?: string;
    }
  ): AsyncGenerator<AnswerStreamChunk>;

  async *streamAnswer<T>(
    query: string,
    options?: {
      text?: boolean;
      model?: "exa" | "exa-pro";
      systemPrompt?: string;
      outputSchema?: Record<string, unknown> | ZodSchema<T>;
      userLocation?: string;
    }
  ): AsyncGenerator<AnswerStreamChunk> {
    // Convert Zod schema to JSON schema if needed
    let outputSchema = options?.outputSchema;
    if (outputSchema && isZodSchema(outputSchema)) {
      outputSchema = zodToJsonSchema(outputSchema);
    }

    // Build the POST body and fetch the streaming response.
    const body = {
      query,
      text: options?.text ?? false,
      stream: true,
      model: options?.model ?? "exa",
      systemPrompt: options?.systemPrompt,
      outputSchema,
      userLocation: options?.userLocation,
    };

    const response = await fetchImpl(this.baseURL + "/answer", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new ExaError(message, response.status, new Date().toISOString());
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ExaError(
        "No response body available for streaming.",
        500,
        new Date().toISOString()
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.replace(/^data:\s*/, "").trim();
          if (!jsonStr || jsonStr === "[DONE]") {
            continue;
          }

          let chunkData: any;
          try {
            chunkData = JSON.parse(jsonStr);
          } catch (err) {
            continue;
          }

          const chunk = this.processChunk(chunkData);
          if (chunk.content || chunk.citations) {
            yield chunk;
          }
        }
      }

      if (buffer.startsWith("data: ")) {
        const leftover = buffer.replace(/^data:\s*/, "").trim();
        if (leftover && leftover !== "[DONE]") {
          try {
            const chunkData = JSON.parse(leftover);
            const chunk = this.processChunk(chunkData);
            if (chunk.content || chunk.citations) {
              yield chunk;
            }
          } catch (e) {}
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private processChunk(chunkData: any): AnswerStreamChunk {
    let content: string | undefined;
    let citations:
      | Array<{
          id: string;
          url: string;
          title?: string;
          publishedDate?: string;
          author?: string;
          text?: string;
        }>
      | undefined;

    if (
      chunkData.choices &&
      chunkData.choices[0] &&
      chunkData.choices[0].delta
    ) {
      content = chunkData.choices[0].delta.content;
    }

    if (chunkData.citations && chunkData.citations !== "null") {
      citations = chunkData.citations.map((c: any) => ({
        id: c.id,
        url: c.url,
        title: c.title,
        publishedDate: c.publishedDate,
        author: c.author,
        text: c.text,
      }));
    }

    return { content, citations };
  }

  private async parseSSEStream<T>(response: Response): Promise<T> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ExaError(
        "No response body available for streaming.",
        500,
        new Date().toISOString()
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    return new Promise<T>(async (resolve, reject) => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.replace(/^data:\s*/, "").trim();
            if (!jsonStr || jsonStr === "[DONE]") {
              continue;
            }

            let chunk: any;
            try {
              chunk = JSON.parse(jsonStr);
            } catch {
              continue; // Ignore malformed JSON lines
            }

            switch (chunk.tag) {
              case "complete":
                reader.releaseLock();
                resolve(chunk.data as T);
                return;
              case "error": {
                const message = chunk.error?.message || "Unknown error";
                reader.releaseLock();
                reject(
                  new ExaError(
                    message,
                    HttpStatusCode.InternalServerError,
                    new Date().toISOString()
                  )
                );
                return;
              }
              // 'progress' and any other tags are ignored for the blocking variant
              default:
                break;
            }
          }
        }

        // If we exit the loop without receiving a completion event
        reject(
          new ExaError(
            "Stream ended without a completion event.",
            HttpStatusCode.InternalServerError,
            new Date().toISOString()
          )
        );
      } catch (err) {
        reject(err as Error);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    });
  }
}

