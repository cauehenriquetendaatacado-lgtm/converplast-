const express = require('express');
const fs = require('fs');
const { Pool } = require('pg');
const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const KEY = process.env.ACCESS_KEY || '';

const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ erro: 'Erro interno' }); });

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

app.get('/api/chaves', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM chaves ORDER BY registrado_em DESC LIMIT 1000');
  res.json(rows);
}));

app.post('/api/chaves', wrap(async (req, res) => {
  const { chave, retirado_por, entregue_por } = req.body;
  if (!chave || !retirado_por || !entregue_por) return res.status(400).json({ erro: 'Informe o nome da chave, quem retirou e quem entregou' });
  const { rows } = await pool.query(
    'INSERT INTO chaves (chave,retirado_por,entregue_por) VALUES ($1,$2,$3) RETURNING *',
    [chave.trim(), retirado_por.trim(), entregue_por.trim()]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/chaves/:id/confirmar', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE chaves SET status='Confirmada', confirmado_em=now()
     WHERE id=$1 AND status<>'Confirmada' RETURNING *`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Não encontrada ou já confirmada' });
  res.json(rows[0]);
}));

app.use(express.static(__dirname + '/public'));

pool.query(fs.readFileSync(__dirname + '/schema.sql', 'utf8'))
  .then(() => app.listen(process.env.PORT || 3000, () => console.log('Online')))
  .catch(e => { console.error('Falha ao conectar no banco', e); process.exit(1); });
