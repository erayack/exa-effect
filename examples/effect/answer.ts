import { Effect, Stream } from "effect";
import { ExaEffect } from "../../src";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Basic answer
  const response = yield* exa.answer("What caused the 2008 financial crisis?");
  console.log("Answer:", response.answer);
  console.log("Citations:", response.citations.length);

  // Streaming answer
  console.log("\nStreaming answer:");
  yield* exa.streamAnswer("Explain quantum computing").pipe(
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        if (chunk.content) process.stdout.write(chunk.content);
      })
    )
  );
  console.log("\n");
});

Effect.runPromise(program).catch(console.error);
