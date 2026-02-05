import { Effect, Stream } from "effect";
import {
  ExaEffect,
  CreateEnrichmentParametersFormat,
  type CreateWebsetParameters,
} from "../../src";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Create a webset
  console.log("Creating webset...");
  const params: CreateWebsetParameters = {
    search: {
      query: "AI research labs that have published research in the last year",
      count: 10,
    },
    enrichments: [
      {
        description: "Primary focus area",
        format: CreateEnrichmentParametersFormat.text,
      },
    ],
  };

  const webset = yield* exa.websets.create(params);
  console.log(`Webset created: ${webset.id}`);

  // Wait until idle
  console.log("Waiting for webset to finish...");
  const idleWebset = yield* exa.websets.waitUntilIdle(webset.id);
  console.log(`Status: ${idleWebset.status}`);

  // List items
  const items = yield* exa.websets.items.list(webset.id, { limit: 5 });
  console.log(`\nFound ${items.data.length} items:`);
  for (const item of items.data) {
    console.log(`- ${item.properties.url}`);
  }

  // Stream all items
  console.log("\nStreaming all items:");
  yield* exa.websets.items.listAll(webset.id).pipe(
    Stream.runForEach((item) =>
      Effect.sync(() => console.log(`  • ${item.properties.url}`))
    )
  );

  // Cleanup
  yield* exa.websets.delete(webset.id);
  console.log("\nWebset deleted");
});

Effect.runPromise(program).catch(console.error);
