import { Effect } from "effect";
import { z } from "zod";
import { ExaEffect } from "../../src";

// Define schemas with Zod
const ComparisonSchema = z.object({
  summary: z.string().describe("Brief summary"),
  pros: z.array(z.string()).describe("List of advantages"),
  cons: z.array(z.string()).describe("List of disadvantages"),
  recommendation: z.string().describe("Final recommendation"),
});

const ResearchOutputSchema = z.object({
  companies: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      founded: z.number().optional(),
    })
  ),
});

const program = Effect.gen(function* () {
  const exa = yield* ExaEffect.make(process.env.EXA_API_KEY!);

  // Zod schema with answer endpoint
  console.log("Using Zod schema with answer:");
  const answerResponse = yield* exa.answer(
    "Compare React vs Vue.js for web development",
    { outputSchema: ComparisonSchema }
  );

  const comparison = answerResponse.answer as z.infer<typeof ComparisonSchema>;
  console.log("Summary:", comparison.summary);
  console.log("Pros:", comparison.pros.join(", "));
  console.log("Cons:", comparison.cons.join(", "));
  console.log("Recommendation:", comparison.recommendation);

  // Zod schema with research endpoint
  console.log("\nUsing Zod schema with research:");
  const { researchId } = yield* exa.research.create({
    instructions: "Find the top 3 AI startups founded in 2024",
    outputSchema: ResearchOutputSchema,
  });

  const result = yield* exa.research.pollUntilFinished(researchId, {
    outputSchema: ResearchOutputSchema,
  });

  const output = result.output as z.infer<typeof ResearchOutputSchema>;
  console.log("Companies found:");
  for (const company of output.companies) {
    console.log(`- ${company.name}: ${company.description}`);
  }
});

Effect.runPromise(program).catch(console.error);
