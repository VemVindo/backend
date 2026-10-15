-- Dados de teste para DESENVOLVIMENTO. Roda a cada "docker compose up" do
-- nestjs-dev (CMD do Dockerfile.dev), depois das migrations. Nunca roda em producao.
--
-- Tudo aqui e ficticio: CPFs/CNPJ gerados pelo algoritmo, emails em example.com
-- (dominio reservado) e telefones inventados. Credenciais no README.
--
-- Idempotente: se o registro ja existe, nada muda. Para voltar ao estado
-- inicial (ex.: refazer o primeiro acesso do entregador), apague o volume:
--   docker compose down -v && docker compose up

BEGIN;

-- As senhas sao hasheadas pelo proprio Postgres (bcrypt, custo 12), no mesmo
-- formato que o bcryptjs do backend confere. Nenhum hash fica no repositorio.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Empresas ------------------------------------------------------------------

INSERT INTO "Empresa" (nome_fantasia, email, telefone, "CNPJ", cpf, cep, logradouro, numero, complemento, bairro, cidade, "UF", razao_social, senha)
VALUES
  ('Cantina Dona Marta', 'cantina@example.com', '61900000001', '11222333000181', NULL,
   '70000000', 'Rua das Flores', 100, 'Loja 1', 'Centro', 'Brasilia', 'DF',
   'Cantina Dona Marta Ltda', crypt('Vemvindo@123', gen_salt('bf', 12))),
  ('Padaria Pao Quente', 'padaria@example.com', '61900000002', NULL, '13579246828',
   '70000001', 'Avenida Principal', 250, NULL, 'Asa Norte', 'Brasilia', 'DF',
   NULL, crypt('Vemvindo@123', gen_salt('bf', 12)))
ON CONFLICT (email) DO NOTHING;

-- Entregadores ----------------------------------------------------------------
-- Ana ainda esta com a senha temporaria (vale 48h a partir do seed): serve para
-- testar o primeiro acesso.
-- Bruno e Carla ja passaram por ele (ciencia dos dados registrada).

INSERT INTO "Entregador" (cpf, nome, telefone, tipo_veiculo, placa, senha, senha_temporaria, ciencia_dados_em, senha_temporaria_expira_em)
VALUES
  ('12345678909', 'Ana Souza',  '61910000001', 'MOTO',      'ABC1D23', crypt('Temp@2026',    gen_salt('bf', 12)), true,  NULL,  NOW() + INTERVAL '48 hours'),
  ('98765432100', 'Bruno Lima', '61910000002', 'CARRO',     'XYZ9E87', crypt('Vemvindo@123', gen_salt('bf', 12)), false, NOW(), NULL),
  ('24681357928', 'Carla Reis', '61910000003', 'BICICLETA', NULL,      crypt('Vemvindo@123', gen_salt('bf', 12)), false, NOW(), NULL)
ON CONFLICT (cpf) DO NOTHING;

-- Vinculos (frota) ------------------------------------------------------------
-- Ana: convite da Cantina, criado no cadastro; aceita depois do primeiro acesso.
-- Bruno: ativo na Cantina e com convite pendente da Padaria.
-- Carla: ativa na Padaria.

INSERT INTO "Contrato" ("idEmpresa", cpf_entregador, status, data_inicio, data_aceite)
SELECT e.id_empresa, v.cpf, v.status::"StatusContrato", NOW(),
       CASE WHEN v.status = 'ATIVO' THEN NOW() END
FROM (VALUES
  ('cantina@example.com', '12345678909', 'PENDENTE'),
  ('cantina@example.com', '98765432100', 'ATIVO'),
  ('padaria@example.com', '98765432100', 'PENDENTE'),
  ('padaria@example.com', '24681357928', 'ATIVO')
) AS v(email, cpf, status)
JOIN "Empresa" e ON e.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM "Contrato" c
  WHERE c."idEmpresa" = e.id_empresa AND c.cpf_entregador = v.cpf AND c.data_fim IS NULL
);

-- Parametros de remuneracao (centavos) ---------------------------------------

INSERT INTO "MetricasPagamento" ("idEmpresa", taxa_fixa, coeficiente, data)
SELECT id_empresa, 800, 150, TIMESTAMP '2026-01-01 00:00:00'
FROM "Empresa" WHERE email = 'cantina@example.com'
ON CONFLICT DO NOTHING;

-- Pedidos -----------------------------------------------------------------------
-- Um de cada situacao, criados relativos a NOW() para o resumo do dia aparecer.
-- Cantina: dois PENDENTE (sem entregador) e um FINALIZADO pelo Bruno, que fica
-- livre para os testes de atribuicao e reatribuicao.
-- Padaria: um EM_ANDAMENTO com a Carla (ela fica ocupada) e um FINALIZADO.
-- Valores em centavos (taxa 800 + 150 por km) e distancia em metros.
-- So entra no banco vazio de pedidos, para nao duplicar a cada subida.

WITH novos AS (
  INSERT INTO "Pedido" (nome_recebedor, telefone_recebedor, cep, logradouro, numero, complemento, bairro, cidade, uf, descricao,
                        status, data_criacao, data_inicio_entrega, data_finalizacao, valor_entrega, distancia, "idEmpresa", cpf_entregador)
  SELECT v.recebedor, v.telefone, v.cep, v.logradouro, v.numero, v.complemento, v.bairro, 'Brasilia', 'DF', v.descricao,
         v.status::"StatusPedido", NOW() - v.criado, NOW() - v.iniciado, NOW() - v.finalizado, v.valor, v.distancia, e.id_empresa, v.cpf
  FROM (VALUES
    ('cantina@example.com', 'Joao Pereira',  '61920000001', '71505090', 'SHIN QI 9 Conj 4',    8,   'Casa 8',      'Lago Norte', 'Tres marmitas',           'PENDENTE',     INTERVAL '20 minutes', NULL::interval,          NULL::interval,          1430, 4200, NULL),
    ('cantina@example.com', 'Rafael Nunes',  '61920000002', '70390070', 'SHCS 706 Bloco B',    12,  NULL,          'Asa Sul',    'Lasanha e suco',          'PENDENTE',     INTERVAL '10 minutes', NULL,                    NULL,                    1115, 2100, NULL),
    ('cantina@example.com', 'Marina Costa',  '61920000003', '70750530', 'SQN 210 Bloco K',     304, 'Apto 304',    'Asa Norte',  'Duas marmitas',           'FINALIZADO',   INTERVAL '3 hours',    INTERVAL '170 minutes',  INTERVAL '140 minutes',  1310, 3400, '98765432100'),
    ('padaria@example.com', 'Pedro Alves',   '61920000004', '70297400', 'SQS 308 Bloco C',     101, 'Apto 101',    'Asa Sul',    'Cesta de cafe da manha',  'EM_ANDAMENTO', INTERVAL '30 minutes', INTERVAL '25 minutes',   NULL,                    1070, 1800, '24681357928'),
    ('padaria@example.com', 'Lucia Ramos',   '61920000005', '70860080', 'CLN 405 Bloco A',     20,  NULL,          'Asa Norte',  'Bolo e dez paes',         'FINALIZADO',   INTERVAL '5 hours',    INTERVAL '290 minutes',  INTERVAL '270 minutes',  1550, 5000, '24681357928')
  ) AS v(email, recebedor, telefone, cep, logradouro, numero, complemento, bairro, descricao, status, criado, iniciado, finalizado, valor, distancia, cpf)
  JOIN "Empresa" e ON e.email = v.email
  WHERE NOT EXISTS (SELECT 1 FROM "Pedido")
  RETURNING id_pedido, cpf_entregador, data_inicio_entrega
)
-- Toda atribuicao abre o historico (entregador anterior nulo), como no backend.
INSERT INTO "HistoricoPedidoEntregadores" (id_pedido, cpf_entregador_antigo, cpf_entregador_novo, data)
SELECT id_pedido, NULL, cpf_entregador, data_inicio_entrega
FROM novos
WHERE cpf_entregador IS NOT NULL;

-- Destino aproximado da SQS 308 (area publica) para o mapa da entrega em
-- andamento funcionar sem a chave de geocodificacao do Google.
UPDATE "Pedido" SET destino_lat = -15.8135, destino_lng = -47.9046
WHERE logradouro = 'SQS 308 Bloco C' AND destino_lat IS NULL;

-- Ponto de saida aproximado das empresas (comercio da Asa Sul e da Asa Norte).
UPDATE "Empresa" SET origem_lat = -15.8059, origem_lng = -47.8935
WHERE email = 'padaria@example.com' AND origem_lat IS NULL;
UPDATE "Empresa" SET origem_lat = -15.7668, origem_lng = -47.8818
WHERE email = 'cantina@example.com' AND origem_lat IS NULL;

-- Quem tem entrega em andamento fica indisponivel, a mesma regra da atribuicao.
UPDATE "Entregador" en SET disponivel = false
WHERE disponivel AND EXISTS (
  SELECT 1 FROM "Pedido" p WHERE p.cpf_entregador = en.cpf AND p.status = 'EM_ANDAMENTO'
);

-- A extensao so e usada aqui; remover evita diferenca entre o banco e as migrations.
DROP EXTENSION pgcrypto;

COMMIT;
