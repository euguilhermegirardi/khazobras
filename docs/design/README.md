# Referência de design

`referencia.html` é o protótipo HTML feito pelo engenheiro (Khaz Engenharia), com dados **anonimizados**
(nomes de clientes, pessoas, fornecedores, telefones, e-mails e endereço trocados por fictícios; números
mantidos). Abra direto no navegador; gráficos e ícones vêm por CDN (Chart.js e Tabler Icons).

**O que copiar dele:** estrutura (sidebar com blocos agrupados + barra superior), cores, tipografia,
espaçamentos, bordas/raios, ícones e os padrões de componente (cards de KPI, tabelas, badges de status,
abas, banners, barras de progresso, gráficos).

**O que NÃO vem dele:** opções da navbar, as duas visões (cliente/admin), funcionalidades e regras de
acesso. Isso vem do `docs/SPEC.md` e do `docs/PLAN-09-frontend.md`.

- **Capturas** (`capturas/`): uma por tela do protótipo, tema claro (+ Dashboard escuro e a página que o
  protótipo gera para o cliente). Regenerar: `node scripts/design-capturas.mjs`. Qual captura usar para cada
  tela nossa: `.claude/rules/frontend-design.md`.
- **Captura da tela construída** (para comparar): `node scripts/capturar-tela.mjs` com mocks em
  `frontend/e2e/mocks/`. É o que o `design-reviewer` usa no `ciclo-tela`.
- A página do cliente do protótipo mostra custo real: copie só o visual (regra 7 do CLAUDE.md).

Nunca versionar a versão original com dados reais (nomes, CREA, notas fiscais, telefones, endereços).
