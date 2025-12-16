### Parte 1: Sequência de Curls (Validação Funcional)Copie e cole no seu terminal.

#### 1. Smoke Test (Pagamento Simples)Envia um pagamento normal. Deve retornar **200 OK**.

```bash
curl -v -X POST http://localhost:9999/payments \
-H "Content-Type: application/json" \
-d "{
  \"correlationId\": \"$(date +%s)-test-01\",
  \"amount\": 100.00
}"

```

#### 2. Teste de Idempotência (Duplicidade)Envia o **mesmo ID** duas vezes. O sistema deve aceitar ambos (200 OK), mas o saldo no banco só deve mudar uma vez.

```bash
ID_DUPLICADO="uuid-fixo-teste-idempotencia"

# Primeira Tentativa (Insere)
curl -s -o /dev/null -w "Tentativa 1: %{http_code}\n" -X POST http://localhost:9999/payments \
-H "Content-Type: application/json" \
-d "{\"correlationId\": \"$ID_DUPLICADO\", \"amount\": 50.00}"

# Segunda Tentativa (Ignora, mas retorna sucesso)
curl -s -o /dev/null -w "Tentativa 2: %{http_code}\n" -X POST http://localhost:9999/payments \
-H "Content-Type: application/json" \
-d "{\"correlationId\": \"$ID_DUPLICADO\", \"amount\": 50.00}"

```

#### 3. Teste de Validação (Payload Inválido)Deve retornar **422 Unprocessable Entity**.

```bash
curl -v -X POST http://localhost:9999/payments \
-H "Content-Type: application/json" \
-d '{
  "correlationId": "id-invalido",
  "amount": "cem reais"
}'

```

#### 4. Teste de Fallback (Simulação de Caos)Vamos derrubar o gateway principal e ver se o sistema redireciona para o fallback automaticamente.

```bash
# 1. Pare o Gateway Default
docker stop zb-payment-processor-payment-processor-default-1

# 2. Envie um pagamento (Deve funcionar via Fallback)
curl -v -X POST http://localhost:9999/payments \
-H "Content-Type: application/json" \
-d "{
  \"correlationId\": \"$(date +%s)-fallback-test\",
  \"amount\": 77.77
}"

# 3. Religue o Gateway Default
docker start zb-payment-processor-payment-processor-default-1

```

#### 5. Auditoria (Verificar Saldos)Veja quanto foi processado pelo Default e quanto foi pelo Fallback.

```bash
curl http://localhost:9999/payments-summary

```


### Parte 2: O Teste de Carga (Simulação da Rinha)Para testar carga de verdade, `curl` em loop não serve (ele é sequencial). Precisamos de concorrência.

Usaremos o **K6**, que é a ferramenta padrão moderna para isso. Não precisa instalar nada, rodaremos via Docker.

#### 1. Crie o arquivo do teste (`load-test.js`)Crie este arquivo na raiz do projeto. Ele simula usuários criando pagamentos freneticamente.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  // Configuração de Carga
  stages: [
    { duration: '10s', target: 10 },  // Warmup: sobe para 10 usuários em 10s
    { duration: '30s', target: 50 },  // Carga: mantem 50 usuários simultâneos
    { duration: '10s', target: 0 },   // Desacelera
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% das requests devem ser menores que 200ms
    http_req_failed: ['rate<0.01'],   // Menos de 1% de erro permitido
  },
};

export default function () {
  // Gera ID aleatório para cada request
  const id = `k6-${randomString(10)}-${Date.now()}`;
  
  const payload = JSON.stringify({
    correlationId: id,
    amount: Math.floor(Math.random() * 1000) + 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Envia POST para o NGINX (nome do serviço na rede docker)
  const res = http.post('http://nginx:9999/payments', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.1); // Pequena pausa para não travar o teste local
}

```

#### 2. Execute o Teste (Via Docker)Este comando conecta o K6 na mesma rede do seu projeto (`zb-bank-network`), permitindo que ele chame o `nginx` diretamente.

```bash
docker run --rm -i \
  --network zb-bank-network \
  -v $(pwd)/load-test.js:/load-test.js \
  grafana/k6 run /load-test.js

```

### O que monitorar enquanto o teste roda?Enquanto o K6 estiver "batendo" na API, abra outro terminal e rode:

```bash
docker stats

```

**Fique de olho em:**

1. **MEM % da `api01` e `api02`:** Se chegar perto do limite (100MB), o Node.js pode crashar.
2. **CPU % do `nginx`:** Se estiver muito alto, o gargalo é o balanceador.
3. **Resultado Final do K6:** Olhe o `http_req_duration` (p95). Se estiver abaixo de 50ms, você está voando. Se estiver acima de 500ms, temos problemas de gargalo.

Me conte o resultado do `p95` assim que rodar!