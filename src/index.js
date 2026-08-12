const CHUNK_SIZE = 1024 * 1024; // 1MB per row, stays well under the 2MB SQL row limit
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB safety cap, see README for why
const TEMP_ACCOUNT_LIFETIME_MS = 60 * 60 * 1000;

export class Drop {
  constructor(state, env) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        filename TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        created_ts INTEGER NOT NULL,
        downloads INTEGER NOT NULL DEFAULT 0
      )`
    );
    this.sql.exec(`CREATE TABLE IF NOT EXISTS chunks (idx INTEGER PRIMARY KEY, data BLOB NOT NULL)`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/store") return this.handleStore(request);
    if (request.method === "GET" && url.pathname === "/meta") return this.handleMeta();
    if (request.method === "GET" && url.pathname === "/download") return this.handleDownload();
    return new Response("not found", { status: 404 });
  }

  async handleStore(request) {
    const filename = decodeURIComponent(request.headers.get("x-filename") || "archivo");
    const mimetype = request.headers.get("x-mimetype") || "application/octet-stream";
    const buf = await request.arrayBuffer();

    if (buf.byteLength === 0) {
      return new Response(JSON.stringify({ error: "Archivo vacío" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (buf.byteLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "Archivo demasiado grande (máx 20MB)" }), { status: 413, headers: { "content-type": "application/json" } });
    }

    const bytes = new Uint8Array(buf);
    const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_SIZE));

    this.sql.exec(`DELETE FROM chunks`);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = bytes.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, bytes.length));
      this.sql.exec(`INSERT INTO chunks (idx, data) VALUES (?, ?)`, i, chunk);
    }

    this.sql.exec(
      `INSERT OR REPLACE INTO meta (id, filename, mimetype, size, chunk_count, created_ts, downloads)
       VALUES (1, ?, ?, ?, ?, ?, 0)`,
      filename, mimetype, bytes.length, chunkCount, Date.now()
    );

    return new Response(JSON.stringify({ ok: true, size: bytes.length, filename }), { headers: { "content-type": "application/json" } });
  }

  async handleMeta() {
    const rows = [...this.sql.exec(`SELECT filename, mimetype, size, created_ts, downloads FROM meta WHERE id = 1`)];
    if (!rows.length) {
      return new Response(JSON.stringify({ exists: false }), { headers: { "content-type": "application/json" } });
    }
    const row = rows[0];
    return new Response(JSON.stringify({
      exists: true,
      filename: row.filename,
      mimetype: row.mimetype,
      size: row.size,
      downloads: row.downloads,
      createdTs: row.created_ts,
      expiryMs: TEMP_ACCOUNT_LIFETIME_MS,
    }), { headers: { "content-type": "application/json" } });
  }

  async handleDownload() {
    const metaRows = [...this.sql.exec(`SELECT filename, mimetype, size FROM meta WHERE id = 1`)];
    if (!metaRows.length) return new Response("No encontrado", { status: 404 });
    const meta = metaRows[0];

    const chunkRows = [...this.sql.exec(`SELECT data FROM chunks ORDER BY idx ASC`)];
    const total = new Uint8Array(meta.size);
    let offset = 0;
    for (const row of chunkRows) {
      const arr = new Uint8Array(row.data);
      total.set(arr, offset);
      offset += arr.length;
    }

    this.sql.exec(`UPDATE meta SET downloads = downloads + 1 WHERE id = 1`);

    const safeName = meta.filename.replace(/[\r\n"]/g, "_");
    return new Response(total, {
      headers: {
        "content-type": meta.mimetype || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
        "content-length": String(meta.size),
        "cache-control": "no-store",
      },
    });
  }
}

const STYLE = `
  :root {
    --bg: #eef0f4; --card: #ffffff; --border: #e2e5ea; --text: #1c1f26; --muted: #7a8091;
    --primary: #3b6bf5; --primary-text: #ffffff; --danger: #c0392b; --radius: 14px;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text); margin: 0; padding: 32px 16px;
    display: flex; justify-content: center;
  }
  .app { width: 100%; max-width: 460px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 16px 4px; }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: 0 1px 3px rgba(20,20,40,0.06); padding: 24px; text-align: center;
  }
  #expiryBanner {
    display: none; padding: 8px 12px; margin-bottom: 16px; font-size: 12.5px; border-radius: 999px;
    background: #eaf0ff; color: #33447a; text-align: center;
  }
  .dropzone {
    border: 2px dashed var(--border); border-radius: 12px; padding: 40px 16px; cursor: pointer;
    color: var(--muted); font-size: 14px; transition: border-color .15s, background .15s;
  }
  .dropzone.drag { border-color: var(--primary); background: #f2f6ff; }
  button {
    font-family: inherit; cursor: pointer; border: none; border-radius: 10px; font-size: 14px;
    font-weight: 600; padding: 11px 20px; transition: opacity .15s;
  }
  button:hover { opacity: .85; }
  button:disabled { opacity: .5; cursor: default; }
  .btn-primary { background: var(--primary); color: var(--primary-text); width: 100%; margin-top: 14px; }
  .btn-ghost { background: #f2f4f8; color: var(--text); }
  #fileInput { display: none; }
  #error { color: var(--danger); font-size: 13px; margin-top: 10px; }
  #qrWrap { display: none; }
  .filemeta { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .filemeta b { color: var(--text); }
  .linkbox {
    display: flex; gap: 8px; margin-top: 14px;
  }
  .linkbox input {
    flex: 1; font-size: 12px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); background: #fafbfc;
  }
  .progress { height: 6px; background: #eee; border-radius: 999px; overflow: hidden; margin-top: 14px; display: none; }
  .progress-bar { height: 100%; width: 0%; background: var(--primary); transition: width .15s; }
`;

function uploadPage() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Airdrop efímero</title>
<script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js"></script>
<style>${STYLE}</style>
</head>
<body>
<div class="app">
  <h1>📦 Airdrop efímero</h1>
  <div class="card">
    <div id="expiryBanner"></div>

    <div id="uploadView">
      <div class="dropzone" id="dropzone">
        Arrastrá un archivo acá, o hacé click para elegirlo<br>
        <span style="font-size:11px;">máx 20MB</span>
      </div>
      <input type="file" id="fileInput">
      <div class="progress" id="progress"><div class="progress-bar" id="progressBar"></div></div>
      <div id="error"></div>
    </div>

    <div id="qrWrap">
      <div class="filemeta"><b id="resFilename"></b></div>
      <div class="filemeta" id="resSize"></div>
      <div id="qrCanvas" style="display:flex; justify-content:center; margin:8px 0 16px;"></div>
      <div class="linkbox">
        <input id="resLink" readonly>
        <button class="btn-ghost" id="copyBtn">copiar</button>
      </div>
      <button class="btn-primary" id="resetBtn">subir otro archivo</button>
    </div>
  </div>
</div>

<script>
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const errorEl = document.getElementById('error');
  const progress = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  const uploadView = document.getElementById('uploadView');
  const qrWrap = document.getElementById('qrWrap');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  });

  function humanSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function uploadFile(file) {
    errorEl.textContent = '';
    progress.style.display = 'block';
    progressBar.style.width = '0%';

    const xhr = new XMLHttpRequest();
    const q = '?name=' + encodeURIComponent(file.name) + '&type=' + encodeURIComponent(file.type || 'application/octet-stream');
    xhr.open('POST', '/upload' + q);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progressBar.style.width = Math.round((e.loaded / e.total) * 100) + '%';
    };
    xhr.onload = () => {
      progress.style.display = 'none';
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = null; }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.url) {
        showResult(data);
      } else {
        errorEl.textContent = (data && data.error) ? data.error : 'Error al subir el archivo.';
      }
    };
    xhr.onerror = () => { progress.style.display = 'none'; errorEl.textContent = 'Error de red al subir.'; };
    xhr.send(file);
  }

  function showResult(data) {
    uploadView.style.display = 'none';
    qrWrap.style.display = 'block';
    document.getElementById('resFilename').textContent = data.filename;
    document.getElementById('resSize').textContent = humanSize(data.size);
    document.getElementById('resLink').value = data.url;
    new QRCode(document.getElementById('qrCanvas'), { text: data.url, width: 200, height: 200 });
    startExpiryCountdown(Date.now(), 60 * 60 * 1000);
  }

  document.getElementById('copyBtn').onclick = () => {
    const input = document.getElementById('resLink');
    input.select();
    navigator.clipboard && navigator.clipboard.writeText(input.value);
  };
  document.getElementById('resetBtn').onclick = () => location.reload();

  function startExpiryCountdown(createdTs, expiryMs) {
    const banner = document.getElementById('expiryBanner');
    banner.style.display = 'block';
    const expiresAt = createdTs + expiryMs;
    function tick() {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        banner.textContent = '⏳ Este archivo ya debería haber desaparecido (cuenta temporal vencida).';
        banner.style.background = '#fdd'; banner.style.color = '#a00';
        return;
      }
      const m = Math.floor(remainingMs / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      banner.textContent = '⏳ El link se autodestruye en ~' + m + ':' + String(s).padStart(2, '0');
      if (remainingMs < 5 * 60000) { banner.style.background = '#fee'; banner.style.color = '#a40'; }
      setTimeout(tick, 1000);
    }
    tick();
  }
</script>
</body>
</html>`;
}

function filePage(token) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Descargar archivo — Airdrop efímero</title>
<style>${STYLE}</style>
</head>
<body>
<div class="app">
  <h1>📦 Airdrop efímero</h1>
  <div class="card">
    <div id="expiryBanner"></div>
    <div id="loading">Cargando...</div>
    <div id="content" style="display:none;">
      <div class="filemeta"><b id="filename"></b></div>
      <div class="filemeta" id="size"></div>
      <a id="downloadBtn" class="btn-primary" style="display:block; text-decoration:none;" href="#">⬇️ Descargar archivo</a>
    </div>
    <div id="notfound" style="display:none; color:#c0392b; font-size:14px;">
      Este archivo no existe o ya expiró (la cuenta temporal que lo alojaba se borró).
    </div>
  </div>
</div>
<script>
  const token = ${JSON.stringify(token)};
  function humanSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }
  fetch('/file/' + token + '/meta').then((r) => r.json()).then((data) => {
    document.getElementById('loading').style.display = 'none';
    if (!data.exists) {
      document.getElementById('notfound').style.display = 'block';
      return;
    }
    document.getElementById('content').style.display = 'block';
    document.getElementById('filename').textContent = data.filename;
    document.getElementById('size').textContent = humanSize(data.size) + ' · ' + data.downloads + ' descarga(s)';
    document.getElementById('downloadBtn').href = '/file/' + token + '/raw';

    const banner = document.getElementById('expiryBanner');
    banner.style.display = 'block';
    const expiresAt = data.createdTs + data.expiryMs;
    function tick() {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        banner.textContent = '⏳ Este archivo ya debería haber desaparecido (cuenta temporal vencida).';
        banner.style.background = '#fdd'; banner.style.color = '#a00';
        return;
      }
      const m = Math.floor(remainingMs / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      banner.textContent = '⏳ Se autodestruye en ~' + m + ':' + String(s).padStart(2, '0');
      if (remainingMs < 5 * 60000) { banner.style.background = '#fee'; banner.style.color = '#a40'; }
      setTimeout(tick, 1000);
    }
    tick();
  }).catch(() => {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('notfound').style.display = 'block';
  });
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/upload") {
      const filename = url.searchParams.get("name") || "archivo";
      const mimetype = url.searchParams.get("type") || "application/octet-stream";
      const token = crypto.randomUUID();
      const id = env.DROP.idFromName(token);
      const stub = env.DROP.get(id);

      const storeReq = new Request("https://drop/store", {
        method: "POST",
        body: request.body,
        headers: {
          "x-filename": encodeURIComponent(filename),
          "x-mimetype": mimetype,
        },
      });
      const res = await stub.fetch(storeReq);
      if (!res.ok) return res;
      const data = await res.json();
      return new Response(JSON.stringify({ ...data, token, url: `${url.origin}/file/${token}` }), {
        headers: { "content-type": "application/json" },
      });
    }

    const m = url.pathname.match(/^\/file\/([a-zA-Z0-9-]+)(?:\/(raw|meta))?$/);
    if (m) {
      const token = m[1];
      const sub = m[2];
      const id = env.DROP.idFromName(token);
      const stub = env.DROP.get(id);

      if (sub === "raw") return stub.fetch("https://drop/download");
      if (sub === "meta") return stub.fetch("https://drop/meta");
      return new Response(filePage(token), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/") {
      return new Response(uploadPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },
};
