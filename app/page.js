'use client';

import './globals.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const TEMPLATES = {
  javascript: `// JavaScript\nfunction twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) return [map.get(comp), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\n\nconsole.log(twoSum([2, 7, 11, 15], 9));\n`,
  typescript: `// TypeScript\nfunction twoSum(nums: number[], target: number): number[] {\n  const map = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) return [map.get(comp)!, i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\n\nconsole.log(twoSum([2, 7, 11, 15], 9));\n`,
  python:     `# Python\nfrom typing import List\n\ndef two_sum(nums: List[int], target: int) -> List[int]:\n    seen = {}\n    for i, n in enumerate(nums):\n        comp = target - n\n        if comp in seen:\n            return [seen[comp], i]\n        seen[n] = i\n    return []\n\nprint(two_sum([2, 7, 11, 15], 9))\n`,
};

const FOLDERS = [
  { lang: 'javascript', label: 'JavaScript', icon: '🟨' },
  { lang: 'typescript', label: 'TypeScript',  icon: '🟦' },
  { lang: 'python',     label: 'Python',       icon: '🐍' },
];

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Aura Dark theme definition ────────────────────────────────────────────────
function defineAuraDark(monaco) {
  monaco.editor.defineTheme('aura-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '',                   foreground: 'edecee', background: '15141b' },
      { token: 'comment',            foreground: '6d6a7c', fontStyle: 'italic' },
      { token: 'keyword',            foreground: 'a277ff', fontStyle: 'bold' },
      { token: 'keyword.operator',   foreground: '82e2ff' },
      { token: 'string',             foreground: 'f694ff' },
      { token: 'number',             foreground: 'ffca85' },
      { token: 'function',           foreground: '61ffca' },
      { token: 'type',               foreground: '82e2ff' },
      { token: 'operator',           foreground: '89ddff' },
      { token: 'delimiter',          foreground: '8b8fa8' },
      { token: 'delimiter.bracket',  foreground: 'c3c0d8' },
      { token: 'regexp',             foreground: '61ffca' },
    ],
    colors: {
      'editor.background':              '#15141b',
      'editor.foreground':              '#edecee',
      'editor.lineHighlightBackground': '#1e1d26',
      'editor.selectionBackground':     '#a277ff33',
      'editor.inactiveSelectionBackground': '#a277ff1a',
      'editorLineNumber.foreground':    '#3a3850',
      'editorLineNumber.activeForeground': '#a277ff',
      'editorCursor.foreground':        '#a277ff',
      'editorSuggestWidget.background': '#1c1b22',
      'editorSuggestWidget.border':     '#2a2838',
      'editorSuggestWidget.selectedBackground': '#a277ff22',
      'editorHoverWidget.background':   '#1c1b22',
      'editorHoverWidget.border':       '#2a2838',
      'scrollbarSlider.background':     '#2a283880',
      'scrollbarSlider.hoverBackground':'#3a385080',
      'scrollbarSlider.activeBackground':'#a277ff44',
    },
  });
}

// ── Auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode]     = useState('login');
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError]   = useState('');

  async function submit(e) {
    e?.preventDefault();
    setError('');
    if (!username || !password) { setError('Fill in both fields'); return; }
    const res  = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
    onLogin(data.username);
  }

  return (
    <div id="auth-screen" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-card">
        <div className="auth-logo" id="auth-title">&#9654; CodeRunner</div>
        <div className="auth-tabs" role="tablist" aria-label="Sign in or register">
          {['login','register'].map(m => (
            <button key={m} className={`auth-tab${mode===m?' active':''}`} role="tab"
              aria-selected={mode===m} onClick={() => { setMode(m); setError(''); }}>
              {m==='login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>
        <div className="auth-fields">
          <input className="auth-input" type="text" placeholder="Username" value={username}
            onChange={e => setUser(e.target.value)} autoComplete="username" maxLength={32}
            onKeyDown={e => e.key==='Enter' && document.getElementById('auth-pass')?.focus()} />
          <input id="auth-pass" className="auth-input" type="password" placeholder="Password" value={password}
            onChange={e => setPass(e.target.value)} autoComplete="current-password"
            onKeyDown={e => e.key==='Enter' && submit()} />
        </div>
        <div className="auth-error" role="alert" aria-live="polite">{error}</div>
        <button className="auth-submit" onClick={submit}>
          {mode==='login' ? 'Sign in' : 'Create account'}
        </button>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [user,         setUser]         = useState(null);
  const [authed,       setAuthed]       = useState(false);
  const [lang,         setLang]         = useState('javascript');
  const [code,         setCode]         = useState(TEMPLATES.javascript);
  const [snippetId,    setSnippetId]    = useState(null);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippets,     setSnippets]     = useState([]);
  const [folderOpen,   setFolderOpen]   = useState({ javascript:true, typescript:true, python:true });
  const [fontSize,     setFontSize]     = useState(13);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [langPicker,   setLangPicker]   = useState(false);
  const [renameId,     setRenameId]     = useState(null);
  const [renameVal,    setRenameVal]    = useState('');
  const [output,       setOutput]       = useState({ html: '<span class="out-meta">Press Run (⌘↵) to execute</span>', status: '', label: 'Output', time: '' });
  const [running,      setRunning]      = useState(false);
  const [toast,        setToast]        = useState('');
  const [popup,        setPopup]        = useState({ show: false, icon: '', text: '' });
  const [outputH,      setOutputH]      = useState(220);

  const editorRef  = useRef(null);
  const monacoRef  = useRef(null);
  const popTimerRef = useRef(null);
  const toastTimer = useRef(null);
  const isResizing = useRef(false);

  // Check existing session
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) { setUser(d.user.username); setAuthed(true); }
      else setAuthed(false);
    });
  }, []);

  // Load snippets when authenticated
  useEffect(() => {
    if (user) loadSnippets();
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's')     { e.preventDefault(); saveSnippet(); }
      if (e.key === 'Escape' && langPicker) setLangPicker(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lang, code, snippetId, snippetTitle, langPicker]);

  // Resize handle — mouse
  useEffect(() => {
    function onMove(e) {
      if (!isResizing.current) return;
      const editorWrap = document.getElementById('editor-wrap');
      if (!editorWrap) return;
      const rect = editorWrap.getBoundingClientRect();
      const newH = Math.max(60, Math.min(rect.height + outputH - 80, (rect.bottom + outputH) - e.clientY));
      setOutputH(newH);
      editorRef.current?.layout();
    }
    function onUp() { isResizing.current = false; document.body.style.userSelect = ''; }
    function onTouch(e) { if (isResizing.current) { onMove({ clientY: e.touches[0].clientY }); e.preventDefault(); } }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouch, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouch);
      document.removeEventListener('touchend', onUp);
    };
  }, [outputH]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }

  function showPopup(icon, text) {
    setPopup({ show: true, icon, text });
    clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => setPopup(p => ({ ...p, show: false })), 2200);
  }

  function switchLang(l) {
    setLang(l);
    if (!snippetId) setCode(TEMPLATES[l]);
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) monacoRef.current.editor.setModelLanguage(model, l);
    }
  }

  async function loadSnippets() {
    try {
      const res = await fetch('/api/snippets');
      const data = await res.json();
      setSnippets(Array.isArray(data) ? data : []);
    } catch { setSnippets([]); }
  }

  async function loadSnippet(id) {
    const res = await fetch(`/api/snippets/${id}`);
    const s   = await res.json();
    setSnippetId(id);
    setSnippetTitle(s.title || '');
    setLang(s.language);
    setCode(s.code || '');
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) monacoRef.current.editor.setModelLanguage(model, s.language);
      editorRef.current.setValue(s.code || '');
    }
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }

  async function deleteSnippet(id) {
    await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
    if (snippetId === id) {
      setSnippetId(null);
      setSnippetTitle('');
      setCode(TEMPLATES[lang]);
    }
    await loadSnippets();
    showToast('Deleted');
  }

  async function saveSnippet() {
    const title = snippetTitle || 'Untitled';
    const body  = { title, language: lang, code };
    try {
      if (snippetId) {
        await fetch(`/api/snippets/${snippetId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/snippets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const s = await res.json();
        setSnippetId(s._id);
        setFolderOpen(f => ({ ...f, [lang]: true }));
      }
      await loadSnippets();
      showToast('Saved');
    } catch { showToast('Save failed'); }
  }

  async function commitRename(s) {
    const newTitle = renameVal.trim() || s.title || 'Untitled';
    try {
      await fetch(`/api/snippets/${s._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, language: s.language, code: s.code || '' }),
      });
      if (snippetId === s._id) setSnippetTitle(newTitle);
    } finally {
      setRenameId(null);
      await loadSnippets();
    }
  }

  async function runCode() {
    const currentCode = editorRef.current ? editorRef.current.getValue() : code;
    setRunning(true);
    setOutput({ html: '<span class="out-meta">Executing…</span>', status: 'running', label: 'Running…', time: '' });
    try {
      const res  = await fetch('/api/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, code: currentCode }),
      });
      const data = await res.json();
      let html = '';
      if (data.output) html += `<span class="out-stdout">${escHtml(data.output)}</span>`;
      if (data.error)  html += `<span class="out-stderr">${escHtml(data.error)}</span>`;
      if (!data.output && !data.error) html = '<span class="out-meta">No output</span>';
      setOutput({ html, status: data.error ? 'err' : 'ok', label: data.error ? 'Error' : 'Output', time: data.elapsed ? `${data.elapsed}ms` : '' });
      showPopup(data.error ? '💀' : '🎉', data.error ? 'Gand Fatt Gayi!!!' : 'Jai Ho Deepak Ki!!');
    } catch (e) {
      setOutput({ html: `<span class="out-stderr">${escHtml(e.message)}</span>`, status: 'err', label: 'Error', time: '' });
      showPopup('💀', 'Gand Fatt Gayi!!!');
    }
    setRunning(false);
  }

  function onEditorMount(editor, monaco) {
    editorRef.current  = editor;
    monacoRef.current  = monaco;
    defineAuraDark(monaco);
    monaco.editor.setTheme('aura-dark');
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCode);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,  saveSnippet);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => setFontSize(f => Math.min(24, f+1)));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => setFontSize(f => Math.max(10, f-1)));
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) setSidebarOpen(o => !o);
    else setSidebarOpen(o => !o);
    setTimeout(() => editorRef.current?.layout(), 250);
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  if (authed === false && !user) {
    return <AuthScreen onLogin={u => { setUser(u); setAuthed(true); }} />;
  }

  return (
    <>
      {/* Sidebar overlay (mobile) */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Language picker modal */}
      {langPicker && (
        <div className="lang-picker-overlay" role="dialog" aria-modal="true"
          onClick={e => e.target === e.currentTarget && setLangPicker(false)}>
          <div className="lang-picker-card">
            <div className="lang-picker-title">Choose a language</div>
            <div className="lang-picker-options">
              {FOLDERS.map(f => (
                <button key={f.lang} className="lang-picker-btn" onClick={() => {
                  setLangPicker(false);
                  setSnippetId(null);
                  setSnippetTitle('');
                  switchLang(f.lang);
                  setCode(TEMPLATES[f.lang]);
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                }}>
                  <span className="lang-picker-icon">{f.icon}</span> {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="topbar">
        <span className="topbar-title" aria-label="CodeRunner">&#9654; CodeRunner</span>
        <nav className="lang-tabs" role="tablist" aria-label="Programming language">
          {[{l:'javascript',label:'JS'},{l:'typescript',label:'TS'},{l:'python',label:'PY'}].map(({l,label}) => (
            <button key={l} className={`lang-tab${lang===l?' active':''}`} role="tab"
              aria-selected={lang===l} onClick={() => switchLang(l)}>{label}</button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="font-controls" role="group" aria-label="Font size">
          <button className="font-btn" onClick={() => setFontSize(f => Math.max(10,f-1))}>A&#8315;</button>
          <span className="font-size-label">{fontSize}</span>
          <button className="font-btn" onClick={() => setFontSize(f => Math.min(24,f+1))}>A&#8314;</button>
        </div>
        <button className="btn btn-save" onClick={saveSnippet}>Save</button>
        <button className="btn btn-run" disabled={running} onClick={runCode}>&#9654; Run</button>
        <div className="user-chip">
          <div className="user-avatar" aria-hidden="true">{user?.[0]?.toUpperCase() ?? '?'}</div>
          <span className="user-name">{user}</span>
        </div>
        <button className="btn-logout" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); }}>Logout</button>
        <button className="btn btn-icon" onClick={toggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar" aria-expanded={sidebarOpen}>&#8942;</button>
      </header>

      {/* Main */}
      <main className="main">
        {/* Sidebar */}
        <aside className={`sidebar${sidebarOpen ? (window.innerWidth <= 768 ? ' open' : '') : ' collapsed'}`} aria-label="Code snippets">
          <div className="sidebar-header" role="heading" aria-level={2}>Snippets</div>
          <div className="snippet-list" role="list">
            {FOLDERS.map(({ lang: fl, label, icon }) => {
              const items = snippets.filter(s => s.language === fl);
              const open  = folderOpen[fl];
              return (
                <div key={fl} className={`folder${open ? ' open' : ''}`}>
                  <div className="folder-header" role="button" aria-expanded={open}
                    onClick={() => setFolderOpen(f => ({ ...f, [fl]: !f[fl] }))}>
                    <span className="folder-arrow">&#9658;</span>
                    <span className="folder-icon" aria-hidden="true">{icon}</span>
                    <span className="folder-label">{label}</span>
                    {items.length > 0 && <span className="folder-count">{items.length}</span>}
                  </div>
                  <div className="folder-items" role="list">
                    {items.map(s => (
                      <div key={s._id} className={`snippet-item${s._id===snippetId?' active':''}`} role="listitem"
                        onClick={e => { if (!e.target.closest('.snippet-actions') && renameId!==s._id) loadSnippet(s._id); }}>
                        {renameId === s._id ? (
                          <input className="snippet-rename-input" autoFocus value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); commitRename(s); } if (e.key==='Escape') setRenameId(null); }}
                            onBlur={() => commitRename(s)} />
                        ) : (
                          <>
                            <span className="snippet-name">{s.title || 'Untitled'}</span>
                            <div className="snippet-actions">
                              <button className="snippet-ren" title="Rename" onClick={e => { e.stopPropagation(); setRenameId(s._id); setRenameVal(s.title || 'Untitled'); }}>&#9998;</button>
                              <button className="snippet-del" title="Delete" onClick={e => { e.stopPropagation(); deleteSnippet(s._id); }}>&#215;</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sidebar-new">
            <button onClick={() => setLangPicker(true)}>+ New snippet</button>
          </div>
        </aside>

        {/* Editor + output */}
        <section className="editor-area" aria-label="Code editor">
          <div className="title-row">
            <input className="snippet-title-input" placeholder="Untitled" maxLength={80}
              aria-label="Snippet title" value={snippetTitle}
              onChange={e => setSnippetTitle(e.target.value)} />
          </div>
          <div className="editor-wrap" id="editor-wrap">
            <MonacoEditor
              height="100%"
              language={lang}
              value={code}
              theme="aura-dark"
              options={{
                fontSize,
                fontFamily: "'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 14, bottom: 14 },
                renderLineHighlight: 'line',
                tabSize: 2,
                wordWrap: 'on',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                bracketPairColorization: { enabled: true },
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                scrollbar: { vertical: 'auto', horizontal: 'auto' },
              }}
              onChange={v => setCode(v ?? '')}
              onMount={onEditorMount}
              beforeMount={monaco => defineAuraDark(monaco)}
            />
          </div>
          <div className="resize-handle" role="separator" aria-orientation="horizontal" aria-label="Resize output panel"
            onMouseDown={() => { isResizing.current = true; document.body.style.userSelect = 'none'; }}
            onTouchStart={e => { isResizing.current = true; e.preventDefault(); }} />
          <section className="output-panel" style={{ height: outputH }} aria-label="Code output">
            <div className="output-header">
              <div className={`output-status${output.status ? ' '+output.status : ''}`} aria-hidden="true" />
              <span>{output.label}</span>
              <div className="spacer" />
              <span aria-label="Execution time">{output.time}</span>
            </div>
            <div className="output-content" role="log" aria-live="polite"
              dangerouslySetInnerHTML={{ __html: output.html }} />
          </section>
        </section>
      </main>

      {/* Big popup */}
      <div className={`big-popup${popup.show ? ' show' : ''}`} aria-live="assertive">
        <div className="big-popup-icon">{popup.icon}</div>
        <div className="big-popup-text">{popup.text}</div>
      </div>

      {/* Toast */}
      {toast && <div className={`toast show`} role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
