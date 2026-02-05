import { Effect } from "effect";
import { ExaEffect } from "../../src";

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  const result = yield* exa.search("latest AI developments", {
    numResults: 10,
    contents: { text: true },
  });

  console.log("Search results:", result.results.length);
  for (const r of result.results) {
    console.log(`- ${r.title}: ${r.url}`);
  }

  return result;
});

Effect.runPromise(program).catch(console.error);
