import { validarAmbiente } from './env.validation';

const BASE = {
  DATABASE_URL: 'postgresql://vemvindo:senha@localhost:5432/vemvindo',
  JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
};

describe('validarAmbiente', () => {
  it('aceita o minimo em desenvolvimento, sem endereco do front', () => {
    expect(() => validarAmbiente(BASE)).not.toThrow();
  });

  it('aceita link em HTTP fora de producao', () => {
    expect(() =>
      validarAmbiente({ ...BASE, URL_FRONTEND: 'http://localhost:3000' }),
    ).not.toThrow();
  });

  it('recusa JWT_SECRET curto', () => {
    expect(() => validarAmbiente({ ...BASE, JWT_SECRET: 'curto' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  describe('em producao', () => {
    const PRODUCAO = { ...BASE, NODE_ENV: 'production' };

    it('aceita URL_FRONTEND em HTTPS', () => {
      expect(() =>
        validarAmbiente({ ...PRODUCAO, URL_FRONTEND: 'https://vemvindo.app' }),
      ).not.toThrow();
    });

    it('recusa URL_FRONTEND em HTTP', () => {
      expect(() =>
        validarAmbiente({ ...PRODUCAO, URL_FRONTEND: 'http://vemvindo.app' }),
      ).toThrow(/precisa começar com https:\/\//);
    });

    it('usa o CORS_ORIGIN quando nao ha URL_FRONTEND', () => {
      expect(() =>
        validarAmbiente({ ...PRODUCAO, CORS_ORIGIN: 'https://vemvindo.app' }),
      ).not.toThrow();
      expect(() =>
        validarAmbiente({ ...PRODUCAO, CORS_ORIGIN: 'http://vemvindo.app' }),
      ).toThrow(/https/);
    });

    it('recusa subir sem endereco do front', () => {
      expect(() => validarAmbiente(PRODUCAO)).toThrow(/URL_FRONTEND/);
    });
  });
});
