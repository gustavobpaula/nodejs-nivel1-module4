import { describe, it } from "node:test";
import { equal } from "node:assert";

describe("Testes para a  integração com o modelo de linguagem", () => {
  it("Deve gerar uma query SQL válida para uma pergunta simples", async (ctx) => {
    ctx.mock.module("ai", {
      exports: {
        generateText: async () => ({
          experimental_output: {
            sql: "SELECT data, COUNT(*) AS total_acessos FROM access_log GROUP BY data;",
            explanation:
              "Esta query conta o número de acessos por dia, agrupando os registros da tabela access_log pela coluna data.",
          },
        }),
        Output: {
          object: ({ schema }) => ({ schema }),
        },
      },
    });

    const { generateSqlObject } = await import("./ai.js");

    const question = "Quantos acessos tivemos por dia?";
    const { sql, explanation } = await generateSqlObject(question);

    equal(typeof sql, "string");
    equal(sql.trim().length > 0, true);

    equal(sql.trim().toUpperCase().startsWith("SELECT"), true);
    equal(typeof explanation, "string");
  });
});
