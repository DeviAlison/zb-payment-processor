// injetar diretamente na rede docker para maior controle e estabilidade
// docker run --rm -i \
//   --network zb-bank-network \
//   -v $(pwd)/test/load-test.js:/load-test.js \
//   grafana/k6 run /load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
// Importando de uma URL remota oficial para garantir compatibilidade
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], 
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const id = uuidv4();
  
  
  const payload = JSON.stringify({
    correlationId: id,            
    amount: Math.floor(Math.random() * 1000) + 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post('http://nginx:9999/payments', payload, params);

  if (res.status !== 201 && res.status !== 200) {
      console.log(`Erro: ${res.status} - ${res.body}`);
  }

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
  });

  sleep(0.1);
}