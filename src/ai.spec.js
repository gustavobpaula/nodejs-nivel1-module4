import { describe, it } from "node:test";
import { equal, throws } from "node:assert";

describe("Testes para a  integração com o modelo de linguagem", () => {
  it("Deve gerar uma query SQL válida para uma pergunta simples", async (ctx) => {
    ctx.mock.module("ai", {
      exports: {
        generateText: async () => ({
          experimental_output: {
            sql: "SELECT date(timestamp) AS dia, COUNT(*) AS total_acessos FROM access_log GROUP BY dia;",
            explanation:
              "Esta query conta o número de acessos por dia, agrupando os registros da tabela access_log pela data do timestamp.",
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

describe("Testes para a validação de SQL", () => {
  it("Deve aceitar SELECT e WITH, removendo o ponto e vírgula final", async () => {
    const { validateSql } = await import("./ai.js");

    equal(
      validateSql("SELECT COUNT(*) FROM access_log;"),
      "SELECT COUNT(*) FROM access_log",
    );
    equal(
      validateSql("WITH t AS (SELECT * FROM access_log) SELECT COUNT(*) FROM t"),
      "WITH t AS (SELECT * FROM access_log) SELECT COUNT(*) FROM t",
    );
  });

  it("Não deve bloquear palavras-chave dentro de strings ou funções", async () => {
    const { validateSql } = await import("./ai.js");

    validateSql("SELECT * FROM access_log WHERE job_title LIKE '%Update%'");
    validateSql("SELECT replace(email, '@', ' at ') FROM access_log");
  });

  it("Deve rejeitar queries que não são SELECT", async () => {
    const { validateSql } = await import("./ai.js");

    throws(() => validateSql("DELETE FROM access_log"), /apenas consultas SELECT/);
    throws(() => validateSql("PRAGMA table_info(access_log)"), /apenas consultas SELECT/);
    throws(
      () => validateSql("WITH t AS (SELECT 1) DELETE FROM access_log"),
      /DELETE/,
    );
  });

  it("Deve rejeitar múltiplas queries e comentários", async () => {
    const { validateSql } = await import("./ai.js");

    throws(
      () => validateSql("SELECT 1; DROP TABLE access_log"),
      /múltiplas queries/,
    );
    throws(
      () => validateSql("SELECT * FROM access_log -- comentário"),
      /comentários/,
    );
  });
});
