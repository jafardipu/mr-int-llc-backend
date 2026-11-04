import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  buildOpenApiDocument,
  documentedOperationCount,
} from '../src/app/docs/buildOpenApi.ts';

const outDir = path.join(process.cwd(), 'docs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'openapi.json');
writeFileSync(outFile, JSON.stringify(buildOpenApiDocument(), null, 2));
console.log(`Wrote ${outFile} (${documentedOperationCount} operations)`);
