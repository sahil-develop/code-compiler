'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="editor-loading"><div className="spinner" /></div>,
});

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

function defineAuraDark(monaco) {
  monaco.editor.defineTheme('aura-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '',                  foreground: 'edecee', background: '15141b' },
      { token: 'comment',           foreground: '6d6a7c', fontStyle: 'italic' },
      { token: 'keyword',           foreground: 'a277ff', fontStyle: 'bold' },
      { token: 'keyword.operator',  foreground: '82e2ff' },
      { token: 'string',            foreground: 'f694ff' },
      { token: 'number',            foreground: 'ffca85' },
      { token: 'function',          foreground: '61ffca' },
      { token: 'type',              foreground: '82e2ff' },
      { token: 'operator',          foreground: '89ddff' },
      { token: 'delimiter',         foreground: '8b8fa8' },
      { token: 'delimiter.bracket', foreground: 'c3c0d8' },
      { token: 'regexp',            foreground: '61ffca' },
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

// ── Skeleton blocks ───────────────────────────────────────────────────────────
function SkeletonAuth() {
  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-skeleton">
          <div className="skeleton auth-skeleton-logo" />
          <div className="skeleton auth-skeleton-tabs" />
          <div className="skeleton auth-skeleton-input" />
          <div className="skeleton auth-skeleton-input" />
          <div className="skeleton auth-skeleton-btn" />
        </div>
      </div>
    </div>
  );
}

function SkeletonSnippets() {
  return (
    <>
      {[0,1,2].map(i => (
        <div key={i} className="snippet-skeleton-folder">
          <div className="skeleton snippet-skeleton-header" />
          <div className="skeleton snippet-skeleton-item" />
          <div className="skeleton snippet-skeleton-item" />
          <div className="skeleton snippet-skeleton-item" />
        </div>
      ))}
    </>
  );
}

function SkeletonOutput() {
  return (
    <div className="output-skeleton">
      <div className="skeleton output-skeleton-line" />
      <div className="skeleton output-skeleton-line" />
      <div className="skeleton output-skeleton-line" />
    </div>
  );
}

// ── Auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode]   = useState('login');
  const [username, setU]  = useState('');
  const [password, setP]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!username || !password) { setError('Fill in both fields'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      onLogin(data.username);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <SkeletonAuth />;

  return (
    <div id="auth-screen" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-card">
        <div className="auth-logo" id="auth-title">&#9654; CodeRunner</div>
        <div className="auth-tabs" role="tablist">
          {['login','register'].map(m => (
            <button key={m} className={`auth-tab${mode===m?' active':''}`} role="tab"
              aria-selected={mode===m} onClick={() => { setMode(m); setError(''); }}>
              {m==='login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>
        <div className="auth-fields">
          <input className="auth-input" type="text" placeholder="Username" value={username}
            onChange={e => setU(e.target.value)} autoComplete="username" maxLength={32}
            onKeyDown={e => e.key==='Enter' && document.getElementById('auth-pass')?.focus()} />
          <input id="auth-pass" className="auth-input" type="password" placeholder="Password" value={password}
            onChange={e => setP(e.target.value)} autoComplete="current-password"
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

// ── Page loading screen ───────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <div className="loader-logo">&#9654; CodeRunner</div>
        <div className="loader-bar"><div className="loader-bar-fill" /></div>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [user,         setUser]         = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [lang,         setLang]         = useState('javascript');
  const [snippetId,    setSnippetId]    = useState(null);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippets,     setSnippets]     = useState([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [folderOpen,   setFolderOpen]   = useState({ javascript:true, typescript:true, python:true });
  const [fontSize,     setFontSize]     = useState(13);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [langPicker,   setLangPicker]   = useState(false);
  const [renameId,     setRenameId]     = useState(null);
  const [renameVal,    setRenameVal]    = useState('');
  const [output,       setOutput]       = useState({ html: '<span class="out-meta">Press Run (⌘↵) to execute</span>', status: '', label: 'Output', time: '' });
  const [running,      setRunning]      = useState(false);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [toast,        setToast]        = useState('');
  const [popup,        setPopup]        = useState({ show: false, icon: '', text: '' });
  const [outputH,      setOutputH]      = useState(220);

  // Refs — never cause re-renders
  const editorRef   = useRef(null);
  const monacoRef   = useRef(null);
  const langRef     = useRef('javascript');   // mirror of lang, readable in closures without stale state
  const snippetIdRef = useRef(null);
  const popTimer    = useRef(null);
  const toastTimer  = useRef(null);
  const isResizing  = useRef(false);
  const outputHRef  = useRef(220);

  // Keep refs in sync
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { snippetIdRef.current = snippetId; }, [snippetId]);
  useEffect(() => { outputHRef.current = outputH; }, [outputH]);

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user.username);
      else setAppReady(true); // no user → go straight to auth, mark ready
    });
  }, []);

  // Load snippets once logged in, then mark app ready
  useEffect(() => {
    if (user) loadSnippets().then(() => setAppReady(true));
  }, [user]);

  // Resize handle events
  useEffect(() => {
    function onMove(clientY) {
      if (!isResizing.current) return;
      const wrap = document.getElementById('editor-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const cur  = outputHRef.current;
      const newH = Math.max(60, Math.min(rect.height + cur - 80, (rect.bottom + cur) - clientY));
      outputHRef.current = newH;
      setOutputH(newH);
      editorRef.current?.layout();
    }
    function onMouseMove(e) { onMove(e.clientY); }
    function onTouchMove(e) { if (isResizing.current) { onMove(e.touches[0].clientY); e.preventDefault(); } }
    function onUp() { isResizing.current = false; document.body.style.userSelect = ''; }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && langPicker) setLangPicker(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [langPicker]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }

  function showPopup(icon, text) {
    setPopup({ show: true, icon, text });
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopup(p => ({ ...p, show: false })), 2200);
  }

  // Switch language — NO state update for editor value, set imperatively
  function switchLang(l) {
    setLang(l);
    langRef.current = l;
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) monacoRef.current.editor.setModelLanguage(model, l);
    }
    if (!snippetIdRef.current) {
      editorRef.current?.setValue(TEMPLATES[l]);
    }
  }

  // ── Snippets ──────────────────────────────────────────────────────────────
  async function loadSnippets() {
    setSnippetsLoading(true);
    try {
      const res = await fetch('/api/snippets');
      const data = await res.json();
      setSnippets(Array.isArray(data) ? data : []);
    } catch { setSnippets([]); }
    finally { setSnippetsLoading(false); }
    // returns void — callers can .then(() => ...) safely
  }

  async function loadSnippet(id) {
    setSnippetLoading(true);
    try {
      const res = await fetch(`/api/snippets/${id}`);
      const s   = await res.json();
      setSnippetId(id);
      snippetIdRef.current = id;
      setSnippetTitle(s.title || '');
      setLang(s.language);
      langRef.current = s.language;
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) monacoRef.current.editor.setModelLanguage(model, s.language);
        editorRef.current.setValue(s.code || '');
      }
      if (window.innerWidth <= 768) setSidebarOpen(false);
    } finally {
      setSnippetLoading(false);
    }
  }

  async function deleteSnippet(id) {
    await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
    if (snippetIdRef.current === id) {
      setSnippetId(null);
      snippetIdRef.current = null;
      setSnippetTitle('');
      editorRef.current?.setValue(TEMPLATES[langRef.current]);
    }
    await loadSnippets();
    showToast('Deleted');
  }

  async function saveSnippet() {
    const code  = editorRef.current?.getValue() ?? '';
    const title = snippetTitle || 'Untitled';
    const body  = { title, language: langRef.current, code };
    try {
      if (snippetIdRef.current) {
        await fetch(`/api/snippets/${snippetIdRef.current}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/snippets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const s = await res.json();
        setSnippetId(s._id);
        snippetIdRef.current = s._id;
        setFolderOpen(f => ({ ...f, [langRef.current]: true }));
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
      if (snippetIdRef.current === s._id) setSnippetTitle(newTitle);
    } finally {
      setRenameId(null);
      await loadSnippets();
    }
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async function runCode() {
    const code = editorRef.current?.getValue() ?? '';
    setRunning(true);
    setOutput({ html: '<span class="out-meta">Executing…</span>', status: 'running', label: 'Running…', time: '' });
    try {
      const res  = await fetch('/api/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: langRef.current, code }),
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

  // ── Editor mount ──────────────────────────────────────────────────────────
  function onEditorMount(editor, monaco) {
    editorRef.current  = editor;
    monacoRef.current  = monaco;
    defineAuraDark(monaco);
    monaco.editor.setTheme('aura-dark');
    // Shortcuts wired directly to functions — no stale closure issues via refs
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCode());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,  () => saveSnippet());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => setFontSize(f => Math.min(24, f+1)));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => setFontSize(f => Math.max(10, f-1)));
  }

  function toggleSidebar() {
    setSidebarOpen(o => !o);
    setTimeout(() => editorRef.current?.layout(), 250);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!appReady) return <PageLoader />;
  if (!user) return <AuthScreen onLogin={u => { setUser(u); setAppReady(false); }} />;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <>
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} />
      )}

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
                  snippetIdRef.current = null;
                  setSnippetTitle('');
                  switchLang(f.lang);
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                }}>
                  <span className="lang-picker-icon">{f.icon}</span> {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="topbar">
        <span className="topbar-title">&#9654; CodeRunner</span>
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
        <button className="btn btn-run" disabled={running} onClick={runCode}>
          {running ? <span className="btn-spinner" /> : '▶ Run'}
        </button>
        <div className="user-chip">
          <div className="user-avatar" aria-hidden="true">{user?.[0]?.toUpperCase() ?? '?'}</div>
          <span className="user-name">{user}</span>
        </div>
        <button className="btn-logout" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); }}>Logout</button>
        <button className="btn btn-icon" onClick={toggleSidebar} aria-label="Toggle sidebar" aria-expanded={sidebarOpen}>&#8942;</button>
      </header>

      <main className="main">
        <aside className={`sidebar${isMobile ? (sidebarOpen ? ' open' : '') : (sidebarOpen ? '' : ' collapsed')}`} aria-label="Code snippets">
          <div className="sidebar-header" role="heading" aria-level={2}>Snippets</div>
          <div className="snippet-list" role="list">
            {snippetsLoading ? <SkeletonSnippets /> : FOLDERS.map(({ lang: fl, label, icon }) => {
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
                      <div key={s._id}
                        className={`snippet-item${s._id===snippetId?' active':''}${snippetLoading&&s._id===snippetId?' loading':''}`}
                        role="listitem"
                        onClick={e => { if (!e.target.closest('.snippet-actions') && renameId!==s._id) loadSnippet(s._id); }}>
                        {renameId === s._id ? (
                          <input className="snippet-rename-input" autoFocus value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); commitRename(s); } if (e.key==='Escape') setRenameId(null); }}
                            onBlur={() => commitRename(s)} />
                        ) : (
                          <>
                            <span className="snippet-name">{s.title || 'Untitled'}</span>
                            {snippetLoading && s._id === snippetId
                              ? <span className="snippet-spinner" />
                              : (
                                <div className="snippet-actions">
                                  <button className="snippet-ren" title="Rename" onClick={e => { e.stopPropagation(); setRenameId(s._id); setRenameVal(s.title || 'Untitled'); }}>&#9998;</button>
                                  <button className="snippet-del" title="Delete" onClick={e => { e.stopPropagation(); deleteSnippet(s._id); }}>&#215;</button>
                                </div>
                              )
                            }
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
              defaultValue={TEMPLATES.javascript}
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
              onMount={onEditorMount}
              beforeMount={defineAuraDark}
            />
          </div>
          <div className="resize-handle" role="separator" aria-label="Resize output panel"
            onMouseDown={() => { isResizing.current = true; document.body.style.userSelect = 'none'; }}
            onTouchStart={e => { isResizing.current = true; e.preventDefault(); }} />
          <section className="output-panel" style={{ height: outputH }} aria-label="Code output">
            <div className="output-header">
              <div className={`output-status${output.status ? ' '+output.status : ''}`} aria-hidden="true" />
              <span>{output.label}</span>
              <div className="spacer" />
              <span>{output.time}</span>
            </div>
            {running
              ? <SkeletonOutput />
              : <div className="output-content" role="log" aria-live="polite"
                  dangerouslySetInnerHTML={{ __html: output.html }} />
            }
          </section>
        </section>
      </main>

      <div className={`big-popup${popup.show ? ' show' : ''}`} aria-live="assertive">
        <div className="big-popup-icon">{popup.icon}</div>
        <div className="big-popup-text">{popup.text}</div>
      </div>

      {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
