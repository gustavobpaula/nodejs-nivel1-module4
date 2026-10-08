import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { MAX_ROWS } from "./constants.js";

const SCHEMA_DESCRIPTION = `
	Tabela: access_log
	Colunas:
	- id TEXT PRIMARY KEY,
	- ip TEXT NOT NULL,
	- username TEXT NOT NULL,
	- first_name TEXT NOT NULL,
	- last_name TEXT NOT NULL,
	- email TEXT NOT NULL,
	- location TEXT NOT NULL,
	- job_area TEXT NOT NULL,
	- company TEXT NOT NULL,
	- job_title TEXT NOT NULL,
	- timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
`;

const BLOCKED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "REPLACE",
  "PRAGMA",
  "ATTACH",
  "DETACH",
  "VACUUM",
];

const model = openai("gpt-4o-mini", {
  apiKey: process.env.OPENAI_API_KEY,
});

const sqlSuggestionSchema = z.object({
  sql: z.string(),
  explanation: z.string(),
});

export function validateSql(sql) {
  if (typeof sql !== "string" || !sql.trim()) {
    throw new Error("SQL inválido: deve ser uma string não vazia.");
  }

  const safeSql = sql.trim().replace(/;\s*$/, "").trim(); // Remove trailing semicolons

  // Ignore string literal contents so values like '%Update%' don't trigger the checks below
  const code = safeSql.replace(/'(?:[^']|'')*'/g, "''");

  if (!/^(SELECT|WITH)\b/i.test(code)) {
    throw new Error("SQL inválido: apenas consultas SELECT são permitidas.");
  }

  if (code.includes(";")) {
    throw new Error("SQL inválido: múltiplas queries não são permitidas.");
  }

  if (/--|\/\*/.test(code)) {
    throw new Error("SQL inválido: comentários não são permitidos.");
  }

  for (const keyword of BLOCKED_KEYWORDS) {
    // Followed by "(" means a function call, e.g. replace(), which is allowed
    if (new RegExp(`\\b${keyword}\\b(?!\\s*\\()`, "i").test(code)) {
      throw new Error(
        `SQL inválido: contém palavra-chave proibida "${keyword}".`,
      );
    }
  }

  return safeSql;
}

export async function generateSqlObject(question) {
  const { experimental_output } = await generateText({
    model,
    experimental_output: Output.object({ schema: sqlSuggestionSchema }),
    system: `
      Você é um assistente especialista em SQLite.

      Sua tarefa é gerar uma única query SQL para responder pergunta do(a) usuário(a).

      Regras obrigatórias:
      - Gere apenas SELECT.
      - Use apenas a tabela access_log.
      - Não use ${BLOCKED_KEYWORDS.join(", ")}.
      - Não gere múltiplas queries.
      - Não use comentários SQL.
      - Se a query retornar registros individuais (sem agregação), use LIMIT ${MAX_ROWS}.
      - Se a pergunta não puder ser respondida com o schema disponível, gere uma query simples de inspeção ou explique a limitação.

      Schema disponível:
      ${SCHEMA_DESCRIPTION}`,
    prompt: `
      Pergunta do usuário:
      ${question}
    `,
  });

  if (!experimental_output?.sql) {
    throw new Error("O modelo nao retornou uma sugestão SQL valida.");
  }

  return {
    sql: validateSql(experimental_output.sql),
    explanation: experimental_output.explanation,
  };
}

/* generateSqlObject("Quantos acessos tivemos por localização?").then((result) => {
  console.log("SQL Gerada:", result.sql);
  console.log("Explicação:", result.explanation);
}); */

export async function generateTextAnswer({ question, sql, rows, truncated }) {
  const { text } = await generateText({
    model,
    system: `
      Responda em português, de forma objetiva, apenas com base nos dados retornados.
      Se o resultado estiver vazio, diga isso claramente.
      Se o resultado estiver truncado, avise que a resposta considera apenas parte dos dados.
    `,
    prompt: `
      Pergunta original:
      ${question}

      SQL executada:
      ${sql}

      Linhas retornadas em JSON${truncated ? ` (resultado truncado: apenas as primeiras ${MAX_ROWS} linhas)` : ""}:
      ${JSON.stringify(rows, null, 2)}

      Resposta:
    `,
  });

  return text.trim();
}
