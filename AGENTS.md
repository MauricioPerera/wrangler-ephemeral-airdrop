# Guía para agentes: desplegar este airdrop con `wrangler --temporary`

Mismo mecanismo que [wrangler-ephemeral-chat](https://github.com/MauricioPerera/wrangler-ephemeral-chat/blob/master/AGENTS.md). Esta guía cubre lo específico de este proyecto.

Si lo que el usuario necesita no es pasar un archivo sino inspeccionar webhooks entrantes, usá el repo hermano [wrangler-ephemeral-webhook](https://github.com/MauricioPerera/wrangler-ephemeral-webhook/blob/master/AGENTS.md).

## Paso 1 — Confirmar que NO hay sesión activa

```bash
npx wrangler whoami
```

Si hay sesión logueada, `--temporary` no crea cuenta temporal — corre igual pero contra la cuenta real del usuario, sin error. Revisar siempre antes. Correr `wrangler logout` si hace falta y el usuario lo autoriza.

## Paso 2 — Instalar y desplegar

```bash
npm install
npx wrangler deploy --temporary
```

Guardar de la salida: la URL del Worker y la claim URL.

## Paso 3 — Verificar que funciona de verdad (con un archivo real)

No basta con que el deploy no dé error. Subir un archivo de prueba y confirmar el roundtrip completo:

```bash
head -c 1048576 /dev/urandom > /tmp/test.bin   # 1MB de prueba
sha256sum /tmp/test.bin

curl -sS -X POST "https://<worker>.<slug>.workers.dev/upload?name=test.bin&type=application/octet-stream" \
  --data-binary @/tmp/test.bin -H "Content-Type: application/octet-stream"
# devuelve {"ok":true,"size":...,"token":"...","url":"https://.../file/<token>"}

curl -sS "https://<worker>.<slug>.workers.dev/file/<token>/raw" -o /tmp/downloaded.bin
sha256sum /tmp/downloaded.bin   # tiene que coincidir con el hash de arriba
```

Si los hashes no coinciden, no reportar el deploy como exitoso.

## Gotchas específicos de este proyecto

- **Límite de archivo**: 20MB por diseño (`MAX_FILE_SIZE` en `src/index.js`). Un archivo mayor devuelve HTTP 413 con `{"error": "..."}` — es intencional, no un bug.
- **Velocidad de subida**: depende de la conexión de quien sube, no del Worker. No confundir con un problema de la cuenta temporal si una subida de varios MB tarda.
- **El QR se genera client-side** con una librería cargada por CDN (`cdn.jsdelivr.net/gh/davidshimjs/qrcodejs`). Si el CDN falla o cambia de URL, el QR no aparece pero el link de texto sigue funcionando igual — no es un fallo del Worker.
- **Sin R2**: el archivo se parte en chunks de 1MB y se guarda en el storage SQLite nativo del Durable Object (no D1). Cada archivo vive en su propio Durable Object, identificado por `idFromName(token)`.

## Gotchas heredados (compartidos con los proyectos hermanos)

- Wrangler cachea la cuenta temporal en `wrangler-temporary-account.toml` (Windows: `%APPDATA%\xdg.config\.wrangler\`, Linux/Mac: `~/.config/.wrangler/`). Si expiró y falla con `Authentication error [code: 10000]`, borrar ese archivo antes de reintentar.
- El timer de 60 minutos es fijo desde la creación, no se extiende con actividad.

## Paso 4 — Comunicar el resultado

Entregar la URL raíz del deploy (para subir archivos) y la claim URL (aclarando la ventana de ~1 hora). Si el usuario ya subió un archivo durante la verificación, también el link `/file/<token>` de esa prueba — o borrarlo/no mencionarlo si era solo un archivo de test sin valor.
