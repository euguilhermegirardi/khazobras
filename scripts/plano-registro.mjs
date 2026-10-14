#!/usr/bin/env node
// Monta a linha do "Registro" do docs/PLAN-09-frontend.md a partir do git (commits da branch + staged).
// Uso (a partir de frontend/):  npm run plano:registro            -> só imprime
//                                npm run plano:registro -- --escrever -> insere no topo do Registro
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
  const resto = conteudo.slice(fim).replace(/^\n/, '')
  if (resto.includes(linha)) {
    console.error('Linha idêntica já existe no Registro; nada escrito.')
    process.exit(0)
  }
  writeFileSync(path, `${conteudo.slice(0, fim)}\n${linha}\n${resto}`)
  console.error('Linha inserida no topo do Registro. Revise, complete o "Pendente:" se houver, e faça git add.')
}
