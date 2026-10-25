CREATE TABLE IF NOT EXISTS correspondencias (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'Encomenda',
  remetente TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  setor TEXT,
  descricao TEXT,
  rastreio TEXT,
  recebido_por TEXT NOT NULL,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Aguardando retirada',
  entregue_a TEXT,
  entregue_por TEXT,
  entregue_em TIMESTAMPTZ,
  obs TEXT
);
CREATE INDEX IF NOT EXISTS idx_corr_status ON correspondencias(status);

CREATE TABLE IF NOT EXISTS chaves (
  id SERIAL PRIMARY KEY,
  chave TEXT NOT NULL,
  retirado_por TEXT NOT NULL,
  entregue_por TEXT NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Aguardando confirmação',
  confirmado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chaves_status ON chaves(status);
