# Colinha Eleitoral 2026 — Pedro Ribeiro (Deputado Federal · 1223)

Simulação de urna eletrônica que monta a "colinha" de votos e gera uma imagem
vertical **1080 × 1920 px** (Stories).

- **Deputado Federal é fixo:** PEDRO RIBEIRO · 1223 · RS. O usuário não digita esse voto.
- O usuário digita, nesta ordem: Deputado Estadual → Senador (1º voto) → Senador (2º voto) → Governador → Presidente.
- Tudo é resolvido por **dados locais** (CSV + fotos + Functions). Nada consulta o TSE em produção e não há credenciais no frontend.

## Estrutura

```text
api/candidates/_local.js   índice em memória do CSV (office:number -> candidato)
api/candidates/lookup.js   GET /api/candidates/lookup?uf=RS&office=DEPUTADO_FEDERAL&number=1223
api/candidates/photo.js    GET /api/candidates/photo?id={SQ_CANDIDATO}&uf=RS  (lê public/fotos/F{UF}{SQ}_div.jpg)
data/consulta_cand_2026_RS.csv   candidatos do RS
data/consulta_cand_2026_BR.csv   candidatos a Presidente (UF = BR)
public/fotos/                    fotos do TSE
public/index.html                urna + card (um único arquivo)
```

## Card: preview = exportação

Existe **um único renderizador**, `renderColinhaCanvas()` (Canvas 2D, dimensão fixa 1080 × 1920,
independente de viewport e de `devicePixelRatio`). A prévia na tela é o próprio PNG gerado por ele — o mesmo
blob que é baixado/compartilhado — então os dois não podem divergir.

Para ajustar o visual do card, edite as constantes `COLINHA` (cores) e `cRow`/`renderColinhaCanvas` (medidas).

## Desenvolvimento

```powershell
npx vercel dev
```

Teste do candidato fixo:

```text
http://localhost:3000/api/candidates/lookup?uf=RS&office=DEPUTADO_FEDERAL&number=1223
```

## Deploy

```powershell
npx vercel
```

Este projeto **não vem vinculado** a nenhum projeto da Vercel (a pasta `.vercel/` do original não foi copiada):
o primeiro `npx vercel` cria/vincula o projeto novo. Região das Functions: `gru1` (São Paulo).

## Fonte

O card usa Montserrat (Google Fonts). Se a fonte não carregar em 5 s, a exportação segue com uma fonte reserva
(Poppins/Segoe UI/Arial) e as medidas se ajustam sozinhas.
