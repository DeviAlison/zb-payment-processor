import fastify from 'fastify';
import { sql } from './db';
import { processarPagamento } from './gateways';

const app = fastify({ logger: false }); 


app.post('/payments', async (req, reply) => {
  const { correlationId, amount } = req.body as any;

  
  if (!correlationId || typeof amount !== 'number') {
    return reply.status(422).send();
  }

  
  const payloadGateway = {
    correlationId,
    amount,
    requestedAt: new Date().toISOString()
  };

  try {
    
    const gatewayUsado = await processarPagamento(payloadGateway);

    if (gatewayUsado === 'falha') {
      
      return reply.status(502).send({ error: 'Processors unavailable' });
    }

    
    
    
    sql`
      INSERT INTO pagamentos (id, valor, gateway, status)
      VALUES (
        ${correlationId}, 
        ${Math.round(amount * 100)}, -- Salva em centavos (INTEGER)
        ${gatewayUsado}, 
        'sucesso'
      )
      ON CONFLICT (id) DO NOTHING -- Garante Idempotência (RRN03)
    `.catch(err => console.error('Erro ao salvar:', err));

    
    return reply.status(200).send();

  } catch (err) {
    return reply.status(500).send();
  }
});


app.get('/payments-summary', async (req, reply) => {
  
  
  try {
    const resultados = await sql`
      SELECT 
        gateway,
        COUNT(*) as total_requests,
        SUM(valor) as total_amount
      FROM pagamentos
      GROUP BY gateway
    `;

    
    const summary = {
      default: { totalRequests: 0, totalAmount: 0 },
      fallback: { totalRequests: 0, totalAmount: 0 }
    };

    for (const row of resultados) {
      if (row.gateway === 'default') {
        summary.default.totalRequests = parseInt(row.total_requests);
        summary.default.totalAmount = parseInt(row.total_amount) / 100; 
      } else if (row.gateway === 'fallback') {
        summary.fallback.totalRequests = parseInt(row.total_requests);
        summary.fallback.totalAmount = parseInt(row.total_amount) / 100;
      }
    }

    return reply.send(summary);
  } catch (err) {
    return reply.status(500).send();
  }
});


app.post('/purge-payments', async (req, reply) => {
  await sql`TRUNCATE TABLE pagamentos`;
  return reply.status(200).send();
});


app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server listening at ${address}`);
});