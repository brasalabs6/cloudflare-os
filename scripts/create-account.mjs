// Script: create-account.mjs
// Conecta ao backend Cloudflare OS via Cap'n Web RPC e cria a conta "guilherme".
// O fluxo replica exatamente o que o frontend faz em SignupPage.tsx:
//   1. Abre WebSocket para /api
//   2. Obtém um RpcStub<PublicApi> via newWebSocketRpcSession
//   3. Computa argon2id(password, SERVICE_SALT + username)
//   4. Chama createAccount(username, displayName, passwordHash)
//   5. Recebe o token de autenticação

import { newWebSocketRpcSession } from '../node_modules/.pnpm/capnweb@0.8.0/node_modules/capnweb/dist/index.js';

// --- Configuração ---
const BACKEND_URL = 'wss://router.arthursznz22.workers.dev/api';
const USERNAME = 'guilherme';
const DISPLAY_NAME = 'Guilherme';
const PASSWORD = 'guilherme123';

// SERVICE_SALT do workshop-shared/src/api.ts — é o salt fixo usado pelo cliente
// para derivar o hash da senha antes de enviá-lo ao servidor.
const SERVICE_SALT = new Uint8Array([
  0xd9, 0x4e, 0x54, 0x1d, 0x29, 0xc1, 0x03, 0x74,
  0x73, 0x7e, 0xb3, 0xe3, 0x34, 0x6d, 0x8f, 0x21,
]);

// --- Hash da senha (argon2id) ---
async function hashPassword(username, password) {
  const { argon2id } = await import('../node_modules/.pnpm/hash-wasm@4.12.0/node_modules/hash-wasm/dist/index.esm.js');

  // Salt = SERVICE_SALT + utf8(username)
  const usernameBuf = new TextEncoder().encode(username);
  const salt = new Uint8Array(SERVICE_SALT.length + usernameBuf.length);
  salt.set(SERVICE_SALT);
  salt.set(usernameBuf, SERVICE_SALT.length);

  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MiB em KiB
    hashLength: 32,
    outputType: 'binary',
  });
}

// --- Main ---
async function main() {
  console.log(`Conectando a ${BACKEND_URL}...`);

  // Cria a sessão RPC sobre WebSocket. O Cap'n Web protocol envia
  // a interface PublicApi como um stub que pode ser chamado diretamente.
  const stub = newWebSocketRpcSession(BACKEND_URL);

  // Primeiro, buscar a config do servidor para confirmar conectividade.
  const config = await stub.getServerConfig();
  console.log(`Servidor: ${config.siteName || 'Cloudflare OS'}`);
  console.log(`Password auth: ${config.passwordAuthEnabled ? 'habilitado' : 'desabilitado'}`);
  console.log(`Signups: ${config.signupsEnabled ? 'abertos' : 'fechados'}`);

  if (!config.passwordAuthEnabled) {
    console.error('ERRO: Autenticação por senha está desabilitada neste deployment.');
    process.exit(1);
  }

  if (!config.signupsEnabled) {
    console.error('ERRO: Signups estão fechados neste deployment.');
    process.exit(1);
  }

  // Computar o hash da senha
  console.log(`Computando hash argon2id para "${USERNAME}"...`);
  const passwordHash = await hashPassword(USERNAME, PASSWORD);

  // Criar a conta
  console.log(`Criando conta "${USERNAME}"...`);
  const token = await stub.createAccount(USERNAME, DISPLAY_NAME, passwordHash);

  if (token) {
    console.log(`\n✅ Conta criada com sucesso!`);
    console.log(`   Username: ${USERNAME}`);
    console.log(`   Display name: ${DISPLAY_NAME}`);
    console.log(`   Token: ${token.slice(0, 20)}...`);
    console.log(`   Senha: ${PASSWORD}`);
    console.log(`\n Guarde este token — ele é a credencial de autenticação.`);
  } else {
    console.log(`\n⚠️  A conta "${USERNAME}" já existe. Tentando login...`);
    const loginToken = await stub.login(USERNAME, passwordHash);
    if (loginToken) {
      console.log(`✅ Login bem-sucedido!`);
      console.log(`   Token: ${loginToken.slice(0, 20)}...`);
    } else {
      console.error(`❌ Login falhou — senha incorreta.`);
      process.exit(1);
    }
  }

  // Disconectar
  stub[Symbol.dispose]();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
