import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { styleText } from "node:util";
import { generateSqlObject, generateTextAnswer } from "./ai.js";
import { createDb } from "./db.js";
import { DB_NAME, MAX_ROWS } from "./constants.js";

if (!existsSync(DB_NAME)) {
  console.error(
    styleText(
      "red",
      `Banco ${DB_NAME} não encontrado. Rode "pnpm run ingest" primeiro.`,
    ),
  );
  process.exit(1);
}

// Read-only connection: even if a write query slips past validation, SQLite rejects it
const db = createDb(DB_NAME, { readOnly: true });

function runQuery(sql) {
  const rows = [];

  // iterate() streams rows, so huge results are never fully loaded into memory
  for (const row of db.prepare(sql).iterate()) {
    if (rows.length === MAX_ROWS) {
      return { rows, truncated: true };
    }
    rows.push({ ...row });
  }

  return { rows, truncated: false };
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

function prompt(text) {
  return new Promise((resolve) => rl.question(text, resolve));
}

rl.on("close", () => {
  db.close();
  console.log(styleText("gray", "Encerrando o agent, até a próxima!"));
  process.exit(0);
});

console.log(
  styleText(
    ["bold", "cyan"],
    "Bem-vindo ao SQL Terminal Agent! Pressione Ctrl+C para sair.",
  ),
);

while (true) {
  const question = await prompt(styleText(["bold", "magenta"], "Pergunta: "));

  if (!question.trim()) {
    continue;
  }

  try {
    const { sql, explanation } = await generateSqlObject(question);

    console.log(styleText("cyan", "\nSQL sugerido:"));
    console.log(styleText("yellow", sql));
    console.log(styleText("cyan", "\nExplicação:"));
    console.log(styleText("yellow", explanation));

    const confirm = await prompt(
      styleText(["bold", "green"], "\nDeseja executar esta query? (s/n): "),
    );
    if (confirm.toLowerCase() === "s") {
      try {
        const { rows, truncated } = runQuery(sql);
        const answer = await generateTextAnswer({
          question,
          sql,
          rows,
          truncated,
        });

        console.log(styleText("green", "\nResposta:"));
        console.log(answer);
      } catch (error) {
        console.error(
          styleText("red", `Erro ao executar a query: ${error.message}`),
        );
      }
    }
  } catch (error) {
    console.error(styleText("red", `Erro: ${error.message}`));
  }
}
