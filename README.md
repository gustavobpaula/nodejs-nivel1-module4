# SQL Terminal Agent

Agente de terminal em Node.js que lê um arquivo grande de logs de acesso usando streams, ingere os registros em um banco SQLite e responde perguntas em linguagem natural. A IA gera uma consulta SQL, que é validada antes de rodar, e responde com base nos registros retornados.

## Requisitos

- Node.js 24 ou superior (usa `node:sqlite` e `--env-file`)
- pnpm 11 (o `package.json` declara a versão em `devEngines`; com o Corepack ativo, ela é baixada automaticamente)
- Uma chave da API da OpenAI (o modelo usado é o `gpt-4o-mini`)

## Instalação

```bash
pnpm install
cp .env.example .env
```

Depois, preencha a chave no `.env`:

```
OPENAI_API_KEY=sk-...
```

## Como rodar

O fluxo tem três etapas: gerar os logs, ingerir no banco e conversar com o agente.

### 1. Gerar o arquivo de logs

```bash
pnpm run seed 100000
```

Gera um arquivo `access.log` com 100.000 registros falsos em JSON, um por linha. Se você omitir a quantidade, a geração continua até você apertar `Ctrl+C`, o que serve para criar um arquivo de vários GB.

Exemplo de linha:

```json
{"ip":"192.168.0.1","username":"Maria.Silva","first_name":"Maria","last_name":"Silva","email":"maria@example.com","location":"São Paulo","job_area":"Data","company":"ACME","job_title":"Analyst","id":"7c9e...","timestamp":"2026-10-07T12:34:56.000Z"}
```

### 2. Ingerir os logs no SQLite

```bash
pnpm run ingest
```

Lê o `access.log` linha a linha com stream e grava na tabela `access_log` do arquivo `logs.db`.

- As inserções rodam em transações de 10.000 registros, então milhões de linhas levam segundos.
- Linhas inválidas são puladas e informadas no terminal.
- Dá para rodar de novo sem problema: registros que já estão no banco são ignorados, e uma ingestão interrompida continua de onde parou.

### 3. Conversar com o agente

```bash
pnpm start
```

Faça uma pergunta em linguagem natural. O agente mostra o SQL sugerido e uma explicação e pergunta se pode executar. Respondendo `s`, ele roda a consulta e responde com base nos dados.

```
Pergunta: Quantos acessos tivemos por localização?

SQL sugerido:
SELECT location, COUNT(*) AS total FROM access_log GROUP BY location

Deseja executar esta query? (s/n): s

Resposta:
...
```

Para sair, aperte `Ctrl+C`. Para desenvolver com recarregamento automático, use `pnpm run dev`.

## Segurança das consultas

O SQL gerado pela IA passa por várias proteções antes de rodar:

- **Validação** (`validateSql` em `src/ai.js`): só aceita consultas que começam com `SELECT` ou `WITH` e rejeita múltiplas queries, comentários e palavras-chave de escrita (`INSERT`, `UPDATE`, `DELETE`, `DROP` etc.).
- **Banco somente leitura**: o agente abre o `logs.db` em modo `readOnly`, então o próprio SQLite recusa qualquer escrita.
- **Confirmação**: nenhuma consulta roda sem você confirmar.
- **Limite de linhas**: no máximo 100 linhas são enviadas à IA. Se o resultado for maior, a resposta avisa que considerou só parte dos dados.

## Testes

```bash
pnpm test
```

Os testes usam o test runner nativo do Node (`node:test`). A chamada à OpenAI é mockada, então não precisam de chave de API. Para rodar em modo watch, use `pnpm run test:watch`.

## Estrutura

```
src/
├── seed.js       # gera o access.log com dados falsos (faker)
├── ingest.js     # lê o log com stream e grava no SQLite
├── index.js      # agente de terminal (perguntas e respostas)
├── ai.js         # geração de SQL, validação e resposta com IA
├── db.js         # conexão e schema do SQLite
├── mocks.js      # geradores de dados falsos
├── constants.js  # nomes de arquivos, tamanhos de lote e limites
└── *.spec.js     # testes
```

Os valores ajustáveis ficam em `src/constants.js`: nome do arquivo de log e do banco, intervalo de progresso, tamanho do lote de ingestão (`BATCH_SIZE`) e limite de linhas enviadas à IA (`MAX_ROWS`).
