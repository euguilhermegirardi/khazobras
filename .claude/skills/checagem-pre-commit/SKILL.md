---
name: checagem-pre-commit
description: Checagem obrigatória antes de qualquer commit no KhazObras — revisa o diff staged e procura segredos. Use sempre que for commitar.
---

# Checagem pré-commit (regra de segurança nº 2)

1. `git status` e `git diff --cached` — ler o diff inteiro, não só o resumo.
2. Procurar segredos no que vai ser commitado:

   ```bash
   git diff --cached | grep -inE "secret|password|passwd|accesskey|secretkey|connectionstring|bearer [a-z0-9]|\$2[aby]\$|BEGIN (RSA|PRIVATE)|r2\.cloudflarestorage"
   ```

3. Conferir que **não** estão staged: `appsettings.Development.json`, `.env*` (exceto `.env.example`),
   `database/seed/`, dumps, `bin/`, `obj/`, `node_modules/`.
4. Conferir `backend/src/KhazObras.Api/appsettings.json`: só Logging + AllowedHosts.
5. Se algo suspeito aparecer: **parar**, não commitar, avisar o usuário com arquivo e linha.
6. Se mudou regra de acesso: confirmar teste novo/atualizado em `KhazObras.Security.Tests`.
7. Build e testes verdes (`dotnet test` e/ou `npm test`) antes do commit.
8. Mensagem de commit curta, no estilo do histórico (`git log --oneline -10`). Nunca `--no-verify`.
