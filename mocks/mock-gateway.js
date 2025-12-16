const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`[MOCK] ${req.method} ${req.url}`);

  res.setHeader('Content-Type', 'application/json');

  // Simula o Health Check (GET /payments/service-health)
  if (req.method === 'GET' && req.url.includes('service-health')) {
    res.writeHead(200);
    res.end(JSON.stringify({ failing: false, minResponseTime: 50 }));
    return;
  }

  // Simula o Processamento (POST /payments)
  if (req.method === 'POST') {
    // Simula uma latência aleatória entre 10ms e 100ms
    setTimeout(() => {
      res.writeHead(200);
      res.end(JSON.stringify({ message: "payment processed successfully" }));
    }, Math.random() * 90 + 10);
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(8080, () => {
  console.log('Mock Gateway rodando na porta 8080');
});