import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { LOG_FILE, LOG_INTERVAL, DB_NAME, BATCH_SIZE } from "./constants.js";
import { createDb } from "./db.js";

const db = createDb(DB_NAME);
const fileStream = createReadStream(LOG_FILE);

const rl = createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

// OR IGNORE skips records already ingested, so the script can be re-run safely
const insert = db.prepare(
  `INSERT OR IGNORE INTO access_log (id, ip, username, first_name, last_name, email, location, job_area, company, job_title, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

console.log(`Lendo ${LOG_FILE} e inserindo registros no banco de dados...`);

let lineNumber = 0;
let inserted = 0;
let duplicates = 0;
let invalid = 0;

// Batching inserts in transactions avoids one disk sync per record
db.exec("BEGIN");

try {
  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue; // Skip empty lines

    try {
      const record = JSON.parse(line);
      const { changes } = insert.run(
        record.id,
        record.ip,
        record.username,
        record.first_name,
        record.last_name,
        record.email,
        record.location,
        record.job_area,
        record.company,
        record.job_title,
        record.timestamp,
      );

      if (changes) inserted++;
      else duplicates++;
    } catch (error) {
      invalid++;
      console.error(`Erro na linha ${lineNumber}: ${error.message}`);
      continue; // Skip this line and continue with the next one
    }

    const processed = inserted + duplicates;

    if (processed % BATCH_SIZE === 0) {
      db.exec("COMMIT");
      db.exec("BEGIN");
    }

    if (processed % LOG_INTERVAL === 0) {
      console.log(`${processed} registros processados...`);
    }
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

console.log(
  `Processamento concluído. Inseridos: ${inserted} | Já existentes: ${duplicates} | Inválidos: ${invalid}`,
);
