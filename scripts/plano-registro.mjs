#!/usr/bin/env node
// Monta a linha do "Registro" do docs/PLAN-09-frontend.md a partir do git (commits da branch + staged).
// Uso (a partir de frontend/):  npm run plano:registro            -> só imprime
//                                npm run plano:registro -- --escrever -> insere/atualiza a linha desta branch
// Uma linha por branch: rodar de novo substitui a anterior (preserva "Pendente: ..." escrito à mão).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const root = git('rev-parse', '--show-toplevel')
if (!root) {
  console.error('Fora de um repositório git.')
  process.exit(1)
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const base = ['origin/main', 'main'].find((ref) => git('rev-parse', '--verify', '--quiet', ref)) ?? 'HEAD'

const commits = git('log', '--no-merges', '--format=%s', `${base}..HEAD`)
  .split('\n')
  .filter(Boolean)
  .reverse()
const files = new Set([
  ...git('diff', '--name-only', `${base}...HEAD`).split('\n'),
  ...git('diff', '--cached', '--name-only').split('\n'),
])
files.delete('docs/PLAN-09-frontend.md')
files.delete('')

const area = (file) => {
  let match
  if ((match = file.match(/^frontend\/src\/features\/([^/]+)\//))) return `features/${match[1]}`
  if (file.startsWith('frontend/src/app/')) return 'front/app'
  if (file.startsWith('frontend/')) return 'front'
  if (file.startsWith('backend/src/')) return 'backend'
  if (file.startsWith('backend/tests/')) return 'testes backend'
  if (file.startsWith('database/')) return 'banco'
  if (file.startsWith('docs/')) return 'docs'
  if (file.startsWith('.claude/') || file.startsWith('.githooks/') || file.startsWith('scripts/')) return 'infra'
  return 'outros'
}
const porArea = new Map()
for (const file of files) porArea.set(area(file), (porArea.get(area(file)) ?? 0) + 1)

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const resumo = commits.length ? commits.join('; ') : '(sem commits ainda; descreva o que está staged)'
const areas = [...porArea].map(([nome, n]) => `${nome} (${n})`).join(', ')
const linha = `- ${hoje} — \`${branch}\`: ${resumo}.${areas ? ` Arquivos: ${areas}.` : ''}`

console.log(linha)

if (process.argv.includes('--escrever')) {
  const path = join(root, 'docs', 'PLAN-09-frontend.md')
  const conteudo = readFileSync(path, 'utf8')
  const titulo = '## Registro\n'
  const i = conteudo.indexOf(titulo)
  if (i === -1) {
    console.error('Seção "## Registro" não encontrada no PLAN-09.')
    process.exit(1)
  }
  const fim = i + titulo.length
  const cabecalho = conteudo.slice(0, fim)
  const linhas = conteudo.slice(fim).replace(/^\n/, '').split('\n')

  // Agrupa entradas: cada uma começa com "- " e pode continuar em linhas indentadas.
  const entradas = []
  for (const l of linhas) {
    if (l.startsWith('- ') || entradas.length === 0) entradas.push([l])
    else entradas.at(-1).push(l)
  }

  // Uma entrada por branch: se já existe, substitui (preservando o "Pendente: ..." escrito à mão).
  const marca = `\`${branch}\`:`
  const idx = entradas.findIndex((e) => e[0].startsWith('- ') && e[0].includes(marca))
  let nova = linha
  if (idx !== -1) {
    const antiga = entradas[idx].map((l) => l.trim()).join(' ')
    const pendente = antiga.match(/Pendente:.*$/)?.[0]
    if (pendente && !nova.includes('Pendente:')) nova = `${nova} ${pendente}`
    entradas.splice(idx, 1)
  }
  entradas.unshift([nova])

  writeFileSync(path, `${cabecalho}\n${entradas.map((e) => e.join('\n')).join('\n')}`)
  console.error(
    idx === -1
      ? 'Linha inserida no topo do Registro. Revise e faça git add.'
      : 'Linha desta branch atualizada (movida para o topo). Revise e faça git add.',
  )
}
