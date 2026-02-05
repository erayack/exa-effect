import { Effect, Stream } from "effect";
import { ExaEffect } from "../../src";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Create research task
  console.log("Creating research task...");
  const { researchId } = yield* exa.research.create({
    instructions: "Find the top 5 AI startups founded in 2024",
    outputSchema: {
      type: "object",
      properties: {
        startups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    },
  });
  console.log(`Research ID: ${researchId}`);

  // Poll until finished
  console.log("Waiting for research to complete...");
  const result = yield* exa.research.pollUntilFinished(researchId);
  console.log(`Status: ${result.status}`);
  console.log("Output:", JSON.stringify(result.output, null, 2));

  // Stream research events (for a new task)
  console.log("\nStreaming research events:");
  const { researchId: streamId } = yield* exa.research.create({
    instructions: "What are the latest breakthroughs in quantum computing?",
  });

  yield* exa.research.stream(streamId, { events: true }).pipe(
    Stream.runForEach((event) =>
      Effect.sync(() => {
        if (event.tag === "progress") {
          console.log(`Progress: ${event.step}`);
        } else if (event.tag === "complete") {
          console.log("Complete!");
        }
      })
    )
  );
});

Effect.runPromise(program).catch(console.error);
