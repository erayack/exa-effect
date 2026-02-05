import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Stream, Exit } from "effect";
import Exa from "../../src";
import { ExaEffect, makeExaService } from "../../src/effect";
import { AnswerStreamChunk } from "../../src/types";
import { ExaError } from "../../src/errors";

/**
 * Test suite for Effect-native wrapper.
 *
 * Tests wrapper behavior, error handling, and stream cleanup.
 */

function createMockAsyncGenerator<T>(
  values: T[],
  returnSpy?: () => void
): AsyncGenerator<T> {
  let index = 0;
  return {
    async next() {
      if (index < values.length) {
        return { value: values[index++], done: false as const };
      }
      return { value: undefined as unknown as T, done: true as const };
    },
    async return(value?: unknown) {
      returnSpy?.();
      return { value: value as T, done: true as const };
    },
    async throw(e?: unknown) {
      throw e;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

describe("Effect Wrapper", () => {
  let mockClient: Exa;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClient = new Exa("test-api-key", "https://api.exa.ai");
  });

  describe("Service Creation", () => {
    it("makeExaService creates service from config", async () => {
      const effect = makeExaService({ apiKey: "test-key" });
      const service = await Effect.runPromise(effect);

      expect(service).toHaveProperty("search");
      expect(service).toHaveProperty("findSimilar");
      expect(service).toHaveProperty("answer");
      expect(service).toHaveProperty("getContents");
      expect(service).toHaveProperty("streamAnswer");
      expect(service).toHaveProperty("research");
      expect(service).toHaveProperty("websets");
    });

    it("ExaEffect.fromClient wraps existing client", async () => {
      const effect = ExaEffect.fromClient(mockClient);
      const service = await Effect.runPromise(effect);

      expect(service).toHaveProperty("search");
      expect(service).toHaveProperty("findSimilar");
      expect(service).toHaveProperty("answer");
    });

    it("ExaEffect.make creates service from apiKey", async () => {
      const effect = ExaEffect.make("test-api-key");
      const service = await Effect.runPromise(effect);

      expect(service).toHaveProperty("search");
      expect(service).toHaveProperty("findSimilar");
    });

    it("makeExaService fails with ExaError when no API key provided", async () => {
      const original = process.env.EXA_API_KEY;
      delete process.env.EXA_API_KEY;

      try {
        const exit = await Effect.runPromiseExit(makeExaService({}));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          expect(error).toBeInstanceOf(ExaError);
          expect(error?.statusCode).toBe(401);
        }
      } finally {
        if (original !== undefined) {
          process.env.EXA_API_KEY = original;
        }
      }
    });

    it("makeExaService surfaces meaningful error message on failure", async () => {
      const original = process.env.EXA_API_KEY;
      delete process.env.EXA_API_KEY;

      try {
        const exit = await Effect.runPromiseExit(makeExaService({}));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          expect(exit.cause.error.message).toContain("API key");
        }
      } finally {
        if (original !== undefined) {
          process.env.EXA_API_KEY = original;
        }
      }
    });
  });

  describe("Core Method Mapping", () => {
    it("search delegates to underlying client", async () => {
      const mockResponse = {
        results: [{ title: "Test", url: "https://example.com", id: "1" }],
        requestId: "req-123",
      };

      const searchSpy = vi
        .spyOn(mockClient, "search")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.search("test query", { numResults: 5 })
      );

      expect(searchSpy).toHaveBeenCalledWith("test query", { numResults: 5 });
      expect(result).toEqual(mockResponse);
    });

    it("findSimilar delegates to underlying client", async () => {
      const mockResponse = {
        results: [{ title: "Similar", url: "https://similar.com", id: "2" }],
        requestId: "req-456",
      };

      const findSimilarSpy = vi
        .spyOn(mockClient, "findSimilar")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.findSimilar("https://example.com", { numResults: 3 })
      );

      expect(findSimilarSpy).toHaveBeenCalledWith("https://example.com", {
        numResults: 3,
      });
      expect(result).toEqual(mockResponse);
    });

    it("answer delegates to underlying client", async () => {
      const mockResponse = {
        answer: "This is the answer",
        citations: [],
        requestId: "req-789",
      };

      const answerSpy = vi
        .spyOn(mockClient, "answer")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(service.answer("What is AI?"));

      expect(answerSpy).toHaveBeenCalledWith("What is AI?", undefined);
      expect(result).toEqual(mockResponse);
    });

    it("getContents delegates to underlying client", async () => {
      const mockResponse = {
        results: [
          { url: "https://example.com", id: "1", text: "Content here" },
        ],
        requestId: "req-contents",
      };

      const getContentsSpy = vi
        .spyOn(mockClient, "getContents")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.getContents(["https://example.com"])
      );

      expect(getContentsSpy).toHaveBeenCalledWith(["https://example.com"], undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("Error Handling", () => {
    it("preserves ExaError instances", async () => {
      const originalError = new ExaError("Not found", 404, undefined, "/test");

      vi.spyOn(mockClient, "search").mockRejectedValueOnce(originalError);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const exit = await Effect.runPromiseExit(service.search("query"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBe(originalError);
        expect(error?.statusCode).toBe(404);
      }
    });

    it("extracts status from error.status", async () => {
      const errorWithStatus = { status: 429, message: "Rate limited" };

      vi.spyOn(mockClient, "search").mockRejectedValueOnce(errorWithStatus);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const exit = await Effect.runPromiseExit(service.search("query"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ExaError);
        expect(error?.statusCode).toBe(429);
        expect(error?.message).toBe("Rate limited");
      }
    });

    it("extracts status from error.statusCode", async () => {
      const errorWithStatusCode = { statusCode: 401, message: "Unauthorized" };

      vi.spyOn(mockClient, "search").mockRejectedValueOnce(errorWithStatusCode);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const exit = await Effect.runPromiseExit(service.search("query"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error?.statusCode).toBe(401);
      }
    });

    it("extracts status from error.response.status", async () => {
      const errorWithResponse = {
        response: { status: 503 },
        message: "Service unavailable",
      };

      vi.spyOn(mockClient, "findSimilar").mockRejectedValueOnce(
        errorWithResponse
      );

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const exit = await Effect.runPromiseExit(
        service.findSimilar("https://example.com")
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error?.statusCode).toBe(503);
      }
    });

    it("defaults to 500 for unknown errors", async () => {
      vi.spyOn(mockClient, "answer").mockRejectedValueOnce("string error");

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const exit = await Effect.runPromiseExit(service.answer("query"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ExaError);
        expect(error?.statusCode).toBe(500);
      }
    });
  });

  describe("Stream Cleanup", () => {
    it("streamAnswer yields values from generator", async () => {
      const chunks: AnswerStreamChunk[] = [
        { content: "Hello" },
        { content: " World" },
      ];

      const mockGen = createMockAsyncGenerator(chunks);
      vi.spyOn(mockClient, "streamAnswer").mockReturnValue(mockGen as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const collected = await Effect.runPromise(
        Stream.runCollect(service.streamAnswer("query"))
      );

      expect(Array.from(collected)).toEqual(chunks);
    });

    it("streamAnswer calls generator.return on early termination", async () => {
      const returnSpy = vi.fn();
      const chunks: AnswerStreamChunk[] = [
        { content: "1" },
        { content: "2" },
        { content: "3" },
      ];

      const mockGen = createMockAsyncGenerator(chunks, returnSpy);
      vi.spyOn(mockClient, "streamAnswer").mockReturnValue(mockGen as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));

      // Take only 1 element, which should trigger cleanup
      const collected = await Effect.runPromise(
        Stream.runCollect(Stream.take(service.streamAnswer("query"), 1))
      );

      expect(Array.from(collected)).toHaveLength(1);
      expect(returnSpy).toHaveBeenCalled();
    });

    it("research.stream yields events from generator", async () => {
      const events = [
        { type: "status" as const, status: "running" },
        { type: "complete" as const },
      ];

      // Mock the research.get method to return an async generator
      const mockGen = createMockAsyncGenerator(events);
      vi.spyOn(mockClient.research, "get").mockResolvedValueOnce(
        mockGen as any
      );

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const collected = await Effect.runPromise(
        Stream.runCollect(service.research.stream("research-123"))
      );

      expect(Array.from(collected)).toEqual(events);
    });

    it("research.stream calls generator.return on early termination", async () => {
      const returnSpy = vi.fn();
      const events = [
        { type: "status" as const, status: "running" },
        { type: "event" as const, data: "data1" },
        { type: "event" as const, data: "data2" },
      ];

      const mockGen = createMockAsyncGenerator(events, returnSpy);
      vi.spyOn(mockClient.research, "get").mockResolvedValueOnce(
        mockGen as any
      );

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));

      const collected = await Effect.runPromise(
        Stream.runCollect(Stream.take(service.research.stream("research-123"), 1))
      );

      expect(Array.from(collected)).toHaveLength(1);
      expect(returnSpy).toHaveBeenCalled();
    });

    it("websets.items.listAll yields items from generator", async () => {
      const items = [
        { id: "item-1", url: "https://example1.com" },
        { id: "item-2", url: "https://example2.com" },
      ];

      const mockGen = createMockAsyncGenerator(items);
      vi.spyOn(mockClient.websets.items, "listAll").mockReturnValue(
        mockGen as any
      );

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const collected = await Effect.runPromise(
        Stream.runCollect(service.websets.items.listAll("webset-123"))
      );

      expect(Array.from(collected)).toEqual(items);
    });

    it("websets.items.listAll calls generator.return on early termination", async () => {
      const returnSpy = vi.fn();
      const items = [
        { id: "item-1", url: "https://example1.com" },
        { id: "item-2", url: "https://example2.com" },
        { id: "item-3", url: "https://example3.com" },
      ];

      const mockGen = createMockAsyncGenerator(items, returnSpy);
      vi.spyOn(mockClient.websets.items, "listAll").mockReturnValue(
        mockGen as any
      );

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));

      const collected = await Effect.runPromise(
        Stream.runCollect(Stream.take(service.websets.items.listAll("webset-123"), 1))
      );

      expect(Array.from(collected)).toHaveLength(1);
      expect(returnSpy).toHaveBeenCalled();
    });
  });

  describe("Research Service", () => {
    it("research.create delegates to underlying client", async () => {
      const mockResponse = {
        researchId: "research-123",
        status: "running",
      };

      const createSpy = vi
        .spyOn(mockClient.research, "create")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.research.create({ instructions: "Research AI" })
      );

      expect(createSpy).toHaveBeenCalledWith({ instructions: "Research AI" });
      expect(result).toEqual(mockResponse);
    });

    it("research.get delegates to underlying client", async () => {
      const mockResponse = {
        researchId: "research-123",
        status: "completed",
        output: { content: "Result" },
      };

      const getSpy = vi
        .spyOn(mockClient.research, "get")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.research.get("research-123")
      );

      expect(getSpy).toHaveBeenCalledWith("research-123", undefined);
      expect(result).toEqual(mockResponse);
    });

    it("research.list delegates to underlying client", async () => {
      const mockResponse = {
        data: [],
        hasMore: false,
        nextCursor: null,
      };

      const listSpy = vi
        .spyOn(mockClient.research, "list")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(service.research.list());

      expect(listSpy).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("Websets Service", () => {
    it("websets.create delegates to underlying client", async () => {
      const mockResponse = {
        id: "webset-123",
        status: "idle",
      };

      const createSpy = vi
        .spyOn(mockClient.websets, "create")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(
        service.websets.create({
          search: { query: "test", count: 10 },
        })
      );

      expect(createSpy).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it("websets.get delegates to underlying client", async () => {
      const mockResponse = {
        id: "webset-123",
        status: "idle",
      };

      const getSpy = vi
        .spyOn(mockClient.websets, "get")
        .mockResolvedValueOnce(mockResponse as any);

      const service = await Effect.runPromise(ExaEffect.fromClient(mockClient));
      const result = await Effect.runPromise(service.websets.get("webset-123"));

      expect(getSpy).toHaveBeenCalledWith("webset-123", undefined);
      expect(result).toEqual(mockResponse);
    });
  });
});
