# 📦 Ephemeral Airdrop

🌐 [Español](./README.md) · [English](./README.en.md) · **Português**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MauricioPerera/wrangler-ephemeral-airdrop)

Você sobe um arquivo, recebe um **QR code e um link**, manda para alguém e essa pessoa baixa — sem nunca ter estado conectada antes, sem instalar nada. Roda numa **conta temporária da Cloudflare**, sem login, e **se autodestrói sozinho** em ~1 hora.

Irmão de [wrangler-ephemeral-chat](https://github.com/MauricioPerera/wrangler-ephemeral-chat) e [wrangler-ephemeral-whiteboard](https://github.com/MauricioPerera/wrangler-ephemeral-whiteboard) — mesma conta temporária, mesma ideia de Durable Object, mas para passar um arquivo pontual.

## Como funciona

- `wrangler deploy --temporary` cria uma conta temporária da Cloudflare (sem login) e implanta o Worker.
- Você sobe um arquivo pela página → ele é dividido em chunks de 1MB e salvo como linhas `BLOB` no SQLite de um Durable Object único para aquele arquivo (identificado por um token aleatório).
- Você recebe um link `/file/<token>` com QR code. Qualquer um que abrir — **sem ter estado conectado antes** — vê o nome/tamanho e baixa o arquivo com um clique. Nada disso usa WebSocket, é HTTP puro.
- Tudo — Worker, arquivo, conta — desaparece sozinho uma hora depois de criado.

## Requisitos

- Node.js
- Wrangler **4.102.0 ou superior**
- **Não estar logado** no Wrangler (`wrangler logout` se já tiver sessão)

## Deploy

```bash
git clone https://github.com/MauricioPerera/wrangler-ephemeral-airdrop.git
cd wrangler-ephemeral-airdrop
npm install
npx wrangler deploy --temporary
```

Abra a URL, suba um arquivo, compartilhe o link ou o QR. Se quiser ficar com o Worker permanentemente, abra a claim URL que o wrangler imprime e complete o login antes da hora acabar.

### Deploy permanente (opcional)

`wrangler login` + `npx wrangler deploy` em vez de `--temporary`, ou o botão **Deploy to Cloudflare** acima.

## Funcionalidades

- **Upload por drag & drop** ou seletor de arquivo, com barra de progresso
- **QR code gerado no navegador** apontando para o link de download (biblioteca `qrcodejs` via CDN, sem backend de QR)
- **Download sem conexão prévia**: quem recebe só precisa abrir o link — é HTTP puro (`GET` + `Content-Disposition: attachment`), não WebSocket
- **Página de download com metadados**: nome, tamanho, quantidade de downloads, e banner de contagem regressiva
- **Verificado byte a byte**: testado com arquivos de até 18MB, hash idêntico entre upload e download

## Limites (testados, não só teóricos)

- **20MB por arquivo** (limite próprio, configurável em `MAX_FILE_SIZE` em `src/index.js`) — pensado para não forçar a memória do Worker/Durable Object ao reconstruir o arquivo inteiro num único `fetch`.
- A velocidade de upload depende da sua conexão (não do Worker) — o download é sempre rápido (~3-4 MB/s nos testes).
- Cada arquivo vive no seu próprio Durable Object (por token), então não compartilha cota com outros arquivos além do storage total da conta temporária.
- Sem R2 em contas temporárias — por isso o arquivo é dividido em chunks de 1MB e salvo como linhas no SQLite nativo do Durable Object (não no D1, que em contas temporárias fica limitado a 100MB).

Mais sobre contas temporárias: [Claim deployments · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/claim-deployments/)

## Estrutura

```
src/index.js       — Worker + Durable Object (Drop) + páginas de upload/download
wrangler.jsonc      — config do Worker e binding do Durable Object
```

## Você é um agente de IA?

Veja [AGENTS.md](./AGENTS.md) para instruções de deploy autônomo com `wrangler --temporary`.
