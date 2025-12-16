import { request } from 'undici';

// Endpoints definidos na especificação
const GATEWAY_DEFAULT = 'http://payment-processor-default:8080';
const GATEWAY_FALLBACK = 'http://payment-processor-fallback:8080';

// Estado global de saúde do Default (cacheado)
let isDefaultAlive = true;

// --- WORKER DE HEALTH CHECK ---
// Roda a cada 5s para respeitar o rate limit do gateway
setInterval(async () => {
  try {
    const { statusCode, body } = await request(`${GATEWAY_DEFAULT}/payments/service-health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      query: {} // Necessário para types do undici
    });

    if (statusCode === 200) {
      const data = await body.json() as any;
      // Se failing=true, marcamos como morto para evitar latência desnecessária
      isDefaultAlive = !data.failing;
    } else {
      isDefaultAlive = false;
    }
  } catch (e) {
    isDefaultAlive = false;
  }
}, 5000);

// --- FUNÇÃO DE PROCESSAMENTO ---
export async function processarPagamento(payload: any) {
  const bodyString = JSON.stringify(payload);
  
  // Estratégia 1: Se o health check já disse que está morto, vai direto pro Fallback
  if (!isDefaultAlive) {
    return tentarFallback(bodyString);
  }

  // Estratégia 2: Tenta Default. Se der erro/timeout, vai pro Fallback
  try {
    const { statusCode } = await request(`${GATEWAY_DEFAULT}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyString,
      headersTimeout: 200, // Timeout agressivo: se não responder em 200ms, aborta
      bodyTimeout: 200
    });

    if (statusCode === 200) {
      return 'default'; // Sucesso no Default
    }
    // Se respondeu 5xx ou 429, joga pro catch/fallback
    throw new Error('Default falhou');

  } catch (err) {
    // Falha no Default (timeout ou erro), tenta Fallback
    return tentarFallback(bodyString);
  }
}

async function tentarFallback(bodyString: string) {
  try {
    const { statusCode } = await request(`${GATEWAY_FALLBACK}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyString,
      headersTimeout: 1000, // Timeout maior no fallback (última esperança)
    });

    if (statusCode === 200) {
      return 'fallback';
    }
    return 'falha'; // Os dois falharam
  } catch (err) {
    return 'falha';
  }
}