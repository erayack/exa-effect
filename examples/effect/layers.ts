import { Effect, Layer } from "effect";
import { ExaEffect, ExaServiceTag } from "../../src";

// Define programs that depend on ExaService
const searchProgram = Effect.gen(function* () {
  const exa = yield* ExaServiceTag;
  return yield* exa.search("latest AI news", { numResults: 5 });
});

const answerProgram = Effect.gen(function* () {
  const exa = yield* ExaServiceTag;
  return yield* exa.answer("What is machine learning?");
});

// Create the layer once
const ExaLive = ExaEffect.layer({ apiKey: process.env.EXA_API_KEY });

// Compose programs
const program = Effect.gen(function* () {
  const searchResult = yield* searchProgram;
  console.log("Search results:", searchResult.results.length);

  const answerResult = yield* answerProgram;
  console.log("Answer:", answerResult.answer);
});

// Provide the layer and run
Effect.runPromise(program.pipe(Effect.provide(ExaLive))).catch(console.error);
