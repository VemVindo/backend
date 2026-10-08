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
-- Ana ainda esta com a senha temporaria: serve para testar o primeiro acesso.
-- Bruno e Carla ja passaram por ele (ciencia dos dados registrada).

INSERT INTO "Entregador" (cpf, nome, telefone, tipo_veiculo, placa, senha, senha_temporaria, ciencia_dados_em)
VALUES
  ('12345678909', 'Ana Souza',  '61910000001', 'MOTO',      'ABC1D23', crypt('Temp@2026',    gen_salt('bf', 12)), true,  NULL),
  ('98765432100', 'Bruno Lima', '61910000002', 'CARRO',     'XYZ9E87', crypt('Vemvindo@123', gen_salt('bf', 12)), false, NOW()),
  ('24681357928', 'Carla Reis', '61910000003', 'BICICLETA', NULL,      crypt('Vemvindo@123', gen_salt('bf', 12)), false, NOW())
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

INSERT INTO "Pedido" (nome_recebedor, telefone_recebedor, cep, logradouro, numero, complemento, bairro, cidade, uf, descricao, status, data_criacao, data_inicio_entrega, data_finalizacao, valor_entrega, "idEmpresa", cpf_entregador, distancia)
SELECT v.recebedor, v.telefone, '70000000', v.logradouro, v.numero, v.complemento, v.bairro, 'Brasilia', 'DF',
       v.descricao, v.status, NOW() - v.criado_ha, NOW() - v.iniciado_ha, NOW() - v.finalizado_ha,
       v.valor, e.id_empresa, v.cpf, v.distancia
FROM (VALUES
  ('cantina@example.com', 'Carla Menezes',  '61920000001', 'SQN 210 Bloco K',  304, NULL,       'Asa Norte', 'Duas marmitas e um suco',  'EM_ANDAMENTO', INTERVAL '40 minutes', INTERVAL '20 minutes', NULL::interval,      1250, '98765432100', 3),
  ('cantina@example.com', 'Rafael Nunes',   '61920000002', 'CLS 706 Bloco B',  12,  NULL,       'Asa Sul',   'Uma lasanha',              'ATRIBUIDO',    INTERVAL '15 minutes', NULL::interval,        NULL::interval,      1100, '98765432100', 2),
  ('cantina@example.com', 'Joao Pereira',   '61920000003', 'SHIN QI 9 Conj 4', 8,   'Casa 8',   'Lago Norte','Tres marmitas',            'PENDENTE',     INTERVAL '5 minutes',  NULL::interval,        NULL::interval,      1550, NULL,          5),
  ('cantina@example.com', 'Thiago Andrade', '61920000004', 'SQS 308 Bloco C',  101, NULL,       'Asa Sul',   'Uma marmita',              'CONCLUIDO',    INTERVAL '3 hours',    INTERVAL '170 minutes', INTERVAL '2 hours', 1400, '98765432100', 4),
  ('padaria@example.com', 'Marina Costa',   '61920000005', 'CLN 110 Bloco D',  25,  NULL,       'Asa Norte', 'Cesta de paes',            'EM_ANDAMENTO', INTERVAL '30 minutes', INTERVAL '10 minutes', NULL::interval,      950,  '24681357928', 1)
) AS v(email, recebedor, telefone, logradouro, numero, complemento, bairro, descricao, status, criado_ha, iniciado_ha, finalizado_ha, valor, cpf, distancia)
JOIN "Empresa" e ON e.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM "Pedido" p WHERE p."idEmpresa" = e.id_empresa);

-- A extensao so e usada aqui; remover evita diferenca entre o banco e as migrations.
DROP EXTENSION pgcrypto;

COMMIT;
