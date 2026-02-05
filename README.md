# Effect wrapper for Exa SDK

[![npm version](https://img.shields.io/npm/v/exa-effect.svg)](https://www.npmjs.com/package/exa-effect)

Effect wrapper for the [Exa](https://exa.ai) SDK — the web search API built for AI.

[Documentation](https://docs.exa.ai) ; [Dashboard](https://dashboard.exa.ai)

## Install

```bash
npm install exa-effect
```

## Quick Start

```ts
import { Effect } from "effect";
import { ExaEffect } from "exa-effect";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Search the web
  const result = yield* exa.search("blog post about artificial intelligence", {
    type: "auto",
    contents: { text: true },
  });

  return result;
});

Effect.runPromise(program);
```

## Search

Find webpages using natural language queries.

```ts
import { Effect } from "effect";
import { ExaEffect } from "exa-effect";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const result = yield* exa.search("interesting articles about space", {
    numResults: 10,
    includeDomains: ["nasa.gov", "space.com"],
    startPublishedDate: "2024-01-01",
    contents: { text: true },
  });

  return result;
});
```

## Contents

Get clean text, highlights, or summaries from any URL.

```ts
const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const { results } = yield* exa.getContents(["https://openai.com/research"], {
    text: true,
    highlights: true,
    summary: true,
  });

  return results;
});
```

## Find Similar

Discover pages similar to a given URL.

```ts
const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const result = yield* exa.findSimilar("https://paulgraham.com/greatwork.html", {
    numResults: 10,
    excludeSourceDomain: true,
    contents: { text: true },
  });

  return result;
});
```

## Answer

Get answers with citations.

```ts
const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const response = yield* exa.answer("What caused the 2008 financial crisis?");
  console.log(response.answer);
});
```

### Streaming Answers

```ts
import { Stream } from "effect";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  yield* exa.streamAnswer("Explain quantum computing").pipe(
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        if (chunk.content) process.stdout.write(chunk.content);
      })
    )
  );
});
```

## Research

Run autonomous research tasks that return structured data.

```ts
const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const { researchId } = yield* exa.research.create({
    instructions: "Find the top 5 AI startups founded in 2024",
    outputSchema: {
      type: "object",
      properties: {
        startups: { type: "array", items: { type: "string" } },
      },
    },
  });

  const result = yield* exa.research.pollUntilFinished(researchId);
  return result;
});
```

## Websets

Build and manage collections of web content with enrichments.

```ts
import { Effect, Stream } from "effect";
import { ExaEffect, CreateEnrichmentParametersFormat } from "exa-effect";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Create a webset with search and enrichments
  const webset = yield* exa.websets.create({
    search: {
      query: "AI research labs",
      count: 25,
    },
    enrichments: [
      {
        description: "Primary focus area",
        format: CreateEnrichmentParametersFormat.text,
      },
    ],
  });

  // Wait until processing completes
  const idleWebset = yield* exa.websets.waitUntilIdle(webset.id);

  // Stream all items
  yield* exa.websets.items.listAll(webset.id).pipe(
    Stream.runForEach((item) =>
      Effect.sync(() => console.log(item.properties.url))
    )
  );

  // Cleanup
  yield* exa.websets.delete(webset.id);
});
```

## Zod Schema Support

Use Zod schemas for type-safe structured outputs.

```ts
import { Effect } from "effect";
import { z } from "zod";
import { ExaEffect } from "exa-effect";

const ComparisonSchema = z.object({
  summary: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Zod schema with answer
  const response = yield* exa.answer("Compare React vs Vue.js", {
    outputSchema: ComparisonSchema,
  });

  const result = response.answer as z.infer<typeof ComparisonSchema>;
  console.log(result.summary);

  // Zod schema with research
  const { researchId } = yield* exa.research.create({
    instructions: "Find top AI startups",
    outputSchema: z.object({
      companies: z.array(z.object({ name: z.string() })),
    }),
  });

  return yield* exa.research.pollUntilFinished(researchId);
});
```

## Dependency Injection with Layers

Use Effect's dependency injection for cleaner architecture.

```ts
import { Effect, Layer } from "effect";
import { ExaEffect, ExaServiceTag, type ExaService } from "exa-effect";

const searchProgram = Effect.gen(function* () {
  const exa = yield* ExaServiceTag;
  return yield* exa.search("latest AI news");
});

const ExaLive = ExaEffect.layer({ apiKey: process.env.EXA_API_KEY });

Effect.runPromise(searchProgram.pipe(Effect.provide(ExaLive)));
```

## Error Handling

All errors are typed as `ExaError` for exhaustive handling.

```ts
import { Effect } from "effect";
import { ExaEffect, ExaError } from "exa-effect";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);
  return yield* exa.search("test query");
}).pipe(
  Effect.catchTag("ExaError", (error) =>
    Effect.sync(() => {
      console.error(`API error ${error.statusCode}: ${error.message}`);
    })
  )
);
```

## TypeScript

Full TypeScript support with types for all methods.

```ts
import { ExaEffect } from "exa-effect";
import type { SearchResponse, RegularSearchOptions, ExaService } from "exa-effect";
```

## Links

- [Documentation](https://docs.exa.ai)
- [API Reference](https://docs.exa.ai/reference)
- [Examples](./examples)

## Contributing

Pull requests welcome! For major changes, open an issue first.

## License

[MIT](LICENSE)
