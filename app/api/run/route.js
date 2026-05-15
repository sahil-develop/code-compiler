import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getSession } from '@/lib/session';

const SUPPORTED = new Set(['javascript', 'typescript', 'python']);

function runJS(code) {
  return new Promise((resolve) => {
    const file = join(tmpdir(), `cr_${Date.now()}.js`);
    writeFileSync(file, code);
    const start = Date.now();
    exec(`"${process.execPath}" "${file}"`, { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
      try { unlinkSync(file); } catch (_) {}
      resolve({ output: stdout, error: stderr || (err && !stderr ? err.message : ''), elapsed: Date.now() - start });
    });
  });
}

function runTS(code) {
  return new Promise((resolve) => {
    let ts;
    try { ts = require('typescript'); } catch {
      return resolve({ output: '', error: 'TypeScript compiler not available', elapsed: 0 });
    }
    const { outputText, diagnostics } = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: false },
      reportDiagnostics: true,
    });
    if (diagnostics?.length) {
      return resolve({ output: '', error: diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'), elapsed: 0 });
    }
    const file = join(tmpdir(), `cr_${Date.now()}.js`);
    writeFileSync(file, outputText);
    const start = Date.now();
    exec(`"${process.execPath}" "${file}"`, { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
      try { unlinkSync(file); } catch (_) {}
      resolve({ output: stdout, error: stderr || (err && !stderr ? err.message : ''), elapsed: Date.now() - start });
    });
  });
}

async function runPython(code) {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;
  const res = await fetch(`${base}/api/run-python`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Python execution service unavailable');
  return res.json();
}

export async function POST(req) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { language, code } = await req.json();
  if (!code) return NextResponse.json({ output: '', error: 'No code provided' });
  if (!SUPPORTED.has(language)) return NextResponse.json({ output: '', error: 'Unsupported language' });

  try {
    let result;
    if (language === 'javascript')      result = await runJS(code);
    else if (language === 'typescript') result = await runTS(code);
    else                                result = await runPython(code);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ output: '', error: err.message });
  }
}
