const express = require('express');
const fs = require('fs');
const { Pool } = require('pg');
const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const KEY = process.env.ACCESS_KEY || '';

const crypto = require('crypto');
const SALT = '28d636ea33f0a21ed6f526e6dcdb09b0', HASH = '0a5c0c626f75051919d40a68c2d4418aa9a2e4d0be30b52e2a02ca7709b204093a6562c254188f9998736de6fc24522c8e90243e452d8b936b4f82e7e7b6c087';
const TRIAL_DIAS = 10;
let falhas = [];
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ erro: 'Erro interno' }); });

async function licenca() {
  const { rows } = await pool.query('SELECT * FROM licenca WHERE id=1');
  const l = rows[0];
  const fim = new Date(new Date(l.iniciado_em).getTime() + TRIAL_DIAS * 864e5);
  return { desbloqueado: l.desbloqueado, bloqueado: !l.desbloqueado && Date.now() > fim.getTime(),
           restante: Math.max(0, Math.ceil((fim - Date.now()) / 864e5)) };
}
app.get('/api/licenca', wrap(async (req, res) => res.json(await licenca())));
app.post('/api/licenca/desbloquear', wrap(async (req, res) => {
  const agora = Date.now(); falhas = falhas.filter(t => agora - t < 9e5);
  if (falhas.length >= 5) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' });
  const h = crypto.scryptSync(String(req.body.senha || ''), SALT, 64);
  if (!crypto.timingSafeEqual(h, Buffer.from(HASH, 'hex'))) { falhas.push(agora); return res.status(403).json({ erro: 'Senha incorreta' }); }
  await pool.query('UPDATE licenca SET desbloqueado=true WHERE id=1');
  res.json({ ok: true });
}));
app.use('/api', (req, res, next) => licenca()
  .then(l => l.bloqueado ? res.status(402).json({ erro: 'Período de teste encerrado', bloqueado: true }) : next())
  .catch(next));

app.use('/api', (req, res, next) => {
  if (KEY && req.get('x-access-key') !== KEY) return res.status(401).json({ erro: 'Chave de acesso inválida' });
  next();
});

app.get('/api/correspondencias', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM correspondencias ORDER BY recebido_em DESC LIMIT 1000');
  res.json(rows);
}));

app.post('/api/correspondencias', wrap(async (req, res) => {
  const b = req.body;
  if (!b.remetente || !b.destinatario || !b.recebido_por) return res.status(400).json({ erro: 'Preencha remetente, destinatário e quem recebeu' });
  const { rows } = await pool.query(
    `INSERT INTO correspondencias (tipo,remetente,destinatario,setor,descricao,rastreio,recebido_por,obs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.tipo || 'Encomenda', b.remetente, b.destinatario, b.setor, b.descricao, b.rastreio, b.recebido_por, b.obs]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/correspondencias/:id/entregar', wrap(async (req, res) => {
  const { entregue_a, entregue_por } = req.body;
  if (!entregue_a || !entregue_por) return res.status(400).json({ erro: 'Informe quem retirou e quem entregou' });
  const { rows } = await pool.query(
    `UPDATE correspondencias SET status='Entregue', entregue_a=$1, entregue_por=$2, entregue_em=now()
     WHERE id=$3 AND status<>'Entregue' RETURNING *`, [entregue_a, entregue_por, req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Não encontrada ou já entregue' });
  res.json(rows[0]);
}));

app.use(express.static(__dirname + '/public'));

pool.query(fs.readFileSync(__dirname + '/schema.sql', 'utf8'))
  .then(() => app.listen(process.env.PORT || 3000, () => console.log('Online')))
  .catch(e => { console.error('Falha ao conectar no banco', e); process.exit(1); });
