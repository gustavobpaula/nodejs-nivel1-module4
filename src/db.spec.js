import { describe, it } from "node:test";
import { equal } from "node:assert";
import { createDb } from "./db.js";
import { generateUser, generateLogEntry } from "./mocks.js";

describe("Testes para a camada de banco de dados", () => {
  const db = createDb();

  it("Deve ingeir um registro no banco de dados", async () => {
    const user = generateUser();
    const record = generateLogEntry(user);

    db.prepare(
      `INSERT INTO access_log (id, ip, username, first_name, last_name, email, location, job_area, company, job_title, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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

    const all = db.prepare("SELECT COUNT(*) FROM access_log").all();

    equal(all[0]["COUNT(*)"], 1);
  });
});
