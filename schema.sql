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

CREATE TABLE IF NOT EXISTS licenca (
  id INT PRIMARY KEY DEFAULT 1,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  desbloqueado BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO licenca (id) VALUES (1) ON CONFLICT DO NOTHING;
