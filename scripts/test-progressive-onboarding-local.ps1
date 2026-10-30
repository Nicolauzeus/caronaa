# CARONAA local regression - run from repository root (PowerShell 5.1+)
# No GitHub Actions, deploy or production DB mutations.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json')) { throw 'Execute na raiz do repositorio caronaa.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node/npm nao encontrado.' }
Write-Host '=== CARONAA: versoes ==='
node --version
npm --version
Write-Host '=== Git branch/status ==='
git branch --show-current
git status --short
Write-Host '=== Instalacao deterministica ==='
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci falhou' }
Write-Host '=== TypeScript ==='
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript falhou' }
Write-Host '=== Testes do cadastro progressivo e locais favoritos ==='
npx vitest run src/lib/onboarding/progressive-onboarding.test.ts src/lib/onboarding/favorite-places.test.ts
if ($LASTEXITCODE -ne 0) { throw 'Testes direcionados falharam' }
Write-Host '=== Suíte geral ==='
npm test
if ($LASTEXITCODE -ne 0) { throw 'Suíte geral falhou' }
Write-Host '=== Build ==='
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build falhou' }
Write-Host 'LOCAL_CHECKS_OK - Falta testar RLS/UX mobile/confirmacao de email em homologacao.'
