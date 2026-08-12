# 📦 Ephemeral Airdrop

🌐 **Español** · [English](./README.en.md) · [Português](./README.pt.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MauricioPerera/wrangler-ephemeral-airdrop)

🌐 **[Landing page](https://mauricioperera.github.io/wrangler-ephemeral-airdrop/)** — presentación visual del proyecto, disponible en español / English / português.

Subís un archivo, te da un **QR y un link**, se lo pasás a alguien y lo descarga — sin que esa persona haya estado conectada antes ni tenga que instalar nada. Corre sobre una **cuenta temporal de Cloudflare**, sin login, y se **autodestruye sola** en ~1 hora.

Hermano de [wrangler-ephemeral-chat](https://github.com/MauricioPerera/wrangler-ephemeral-chat) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-chat/)) y [wrangler-ephemeral-whiteboard](https://github.com/MauricioPerera/wrangler-ephemeral-whiteboard) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-whiteboard/)) y de [wrangler-ephemeral-sandbox](https://github.com/MauricioPerera/wrangler-ephemeral-sandbox) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-sandbox/)) — misma cuenta temporal, mismo Durable Object, pero para pasar un archivo puntual o dejar que un agente ejecute JavaScript aislado.

## Cómo funciona

- `wrangler deploy --temporary` crea una cuenta de Cloudflare temporal (sin login) y despliega el Worker.
- Subís un archivo desde la página → se parte en chunks de 1MB y se guarda como filas `BLOB` en el SQLite de un Durable Object propio de ese archivo (identificado por un token random).
- Te da un link `/file/<token>` con QR. Cualquiera que lo abra —**sin haber estado conectado antes**— ve el nombre/tamaño y descarga el archivo con un click. No usa WebSocket para nada de esto, es HTTP normal.
- Todo —Worker, archivo, cuenta— desaparece solo a la hora de creado.

## Requisitos

- Node.js
- Wrangler **4.102.0 o superior**
- **No estar logueado** en Wrangler (`wrangler logout` si ya tenés sesión)

## Deploy

```bash
git clone https://github.com/MauricioPerera/wrangler-ephemeral-airdrop.git
cd wrangler-ephemeral-airdrop
npm install
npx wrangler deploy --temporary
```

Abrí la URL, subí un archivo, compartí el link o el QR. Si querés quedarte con el Worker de forma permanente, abrí la claim URL que imprime wrangler y completá el login antes de que venza la hora.

### Deploy permanente (opcional)

`wrangler login` + `npx wrangler deploy` en vez de `--temporary`, o el botón **Deploy to Cloudflare** de arriba.

## Funcionalidades

- **Subida por drag & drop** o selector de archivo, con barra de progreso
- **QR generado en el navegador** apuntando al link de descarga (librería `qrcodejs` por CDN, sin backend de QR)
- **Descarga sin conexión previa**: el receptor solo necesita abrir el link — es HTTP normal (`GET` + `Content-Disposition: attachment`), no WebSocket
- **Página de descarga con metadata**: nombre, tamaño, cantidad de descargas, y banner de cuenta regresiva
- **Verificado bit a bit**: probado con archivos de hasta 18MB, hash idéntico entre lo subido y lo descargado

## Límites (probados, no solo teóricos)

- **20MB por archivo** (límite propio, configurable en `MAX_FILE_SIZE` en `src/index.js`) — pensado para no forzar la memoria del Worker/Durable Object al reconstruir el archivo completo en un solo `fetch`.
- La velocidad de subida depende de tu conexión (no del Worker) — la descarga sí es rápida siempre (~3-4 MB/s en las pruebas).
- Cada archivo vive en su propio Durable Object (por token), no comparte cuota con otros archivos de la misma cuenta temporal más allá del storage total de la cuenta.
- Sin R2 en cuentas temporales — por eso el archivo se parte en chunks de 1MB y se guarda como filas en el SQLite nativo del Durable Object (no en D1, que en cuentas temporales está limitado a 100MB).

Más info sobre cuentas temporales: [Claim deployments · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/claim-deployments/)

## Estructura

```
src/index.js       — Worker + Durable Object (Drop) + páginas de subida/descarga
wrangler.jsonc      — config del Worker y binding del Durable Object
```

## ¿Sos un agente de IA?

Ver [AGENTS.md](./AGENTS.md) para instrucciones de despliegue autónomo con `wrangler --temporary`.
