const fs = require('fs');
const path = require('path');

const { removeBackground } = require('@imgly/background-removal-node');

const PHOTO_ROOTS = [
  path.join(process.cwd(), 'public', 'fotos'),
  path.join(process.cwd(), 'public', 'photos'),
  path.join(process.cwd(), 'fotos'),
  path.join(process.cwd(), 'photos'),
];

const REMOVED_BG_ROOTS = [
  path.join(process.cwd(), 'public', 'fotos-sem-fundo'),
  path.join(process.cwd(), 'fotos-sem-fundo'),
];

const EXTENSIONS = [
  'jpg',
  'jpeg',
  'JPG',
  'JPEG',
  'png',
  'PNG',
  'webp',
  'WEBP',
];

function query(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query;
  }

  const protocol = req.headers?.['x-forwarded-proto'] || 'http';
  const host = req.headers?.host || 'localhost';

  const parsed = new URL(
    req.url || '/',
    `${protocol}://${host}`
  );

  return Object.fromEntries(parsed.searchParams.entries());
}

function normalize(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase();
}

function getEffectiveUf(office, uf = 'RS') {
  return normalize(office) === 'PRESIDENTE'
    ? 'BR'
    : normalize(uf);
}

function isSafeId(value) {
  return /^[0-9A-Za-z_-]{1,80}$/.test(
    String(value || '')
  );
}

/**
 * Nome padrão das fotos do TSE:
 *
 * RS:
 * FRS{SQ_CANDIDATO}_div.jpg
 *
 * Presidente:
 * FBR{SQ_CANDIDATO}_div.jpg
 */
function findPhotoFile(id, uf, office = '') {
  const safeId = String(id || '').trim();
  const safeUf = getEffectiveUf(
    office,
    uf || 'RS'
  );

  if (
    !isSafeId(safeId) ||
    !/^[A-Z]{2}$/.test(safeUf)
  ) {
    return null;
  }

  const filenameBase = `F${safeUf}${safeId}_div`;

  for (const root of PHOTO_ROOTS) {
    for (const extension of EXTENSIONS) {
      const file = path.join(
        root,
        `${filenameBase}.${extension}`
      );

      if (fs.existsSync(file)) {
        return file;
      }
    }
  }

  return null;
}

/**
 * Local onde ficará a versão sem fundo.
 */
function getOutputFile(id, uf, office = '') {
  const safeId = String(id || '').trim();
  const safeUf = getEffectiveUf(
    office,
    uf || 'RS'
  );

  const filename = `F${safeUf}${safeId}_div.png`;

  for (const root of REMOVED_BG_ROOTS) {
    return path.join(root, filename);
  }

  return null;
}

/**
 * Procura uma versão já processada.
 *
 * Isso é importante para não executar a IA
 * toda vez que alguém solicitar a mesma foto.
 */
function findProcessedPhoto(id, uf, office = '') {
  const outputFile = getOutputFile(
    id,
    uf,
    office
  );

  if (
    outputFile &&
    fs.existsSync(outputFile)
  ) {
    return outputFile;
  }

  return null;
}

/**
 * Remove o fundo usando IA local.
 */
async function processBackground(inputFile, outputFile) {
  console.log(`[BACKGROUND] Processando: ${inputFile}`);

  // Lê a imagem original
  const inputBuffer = await fs.promises.readFile(inputFile);

  // Descobre o MIME pelo arquivo
  const extension = path
    .extname(inputFile)
    .toLowerCase();

  let mimeType;

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      mimeType = 'image/jpeg';
      break;

    case '.png':
      mimeType = 'image/png';
      break;

    case '.webp':
      mimeType = 'image/webp';
      break;

    default:
      throw new Error(
        `Formato de imagem não suportado: ${extension}`
      );
  }

  // IMPORTANTE:
  // Buffer sozinho não informa o formato.
  // O Blob informa explicitamente image/jpeg, image/png etc.
  const inputBlob = new Blob(
    [inputBuffer],
    {
      type: mimeType,
    }
  );

  console.log(
    `[BACKGROUND] Formato detectado: ${mimeType}`
  );

  const blob = await removeBackground(
    inputBlob,
    {
      model: 'medium',

      output: {
        format: 'image/png',
        quality: 0.9,
      },

      progress: (key, current, total) => {
        console.log(
          `[BACKGROUND] ${key}: ${current}/${total}`
        );
      },
    }
  );

  // Blob → Buffer
  const outputBuffer = Buffer.from(
    await blob.arrayBuffer()
  );

  // Cria a pasta de destino
  await fs.promises.mkdir(
    path.dirname(outputFile),
    {
      recursive: true,
    }
  );

  // Salva PNG transparente
  await fs.promises.writeFile(
    outputFile,
    outputBuffer
  );

  console.log(
    `[BACKGROUND] ✓ Salvo: ${outputFile}`
  );

  return outputFile;
}
module.exports = async function handler(
  req,
  res
) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res
      .status(405)
      .send('Método não permitido.');
  }

  const params = query(req);

  const id = String(
    params.id == null
      ? ''
      : params.id
  ).trim();

  const office = normalize(
    params.office || ''
  );

  const uf = getEffectiveUf(
    office,
    params.uf || 'RS'
  );

  if (!id || !isSafeId(id)) {
    return res
      .status(400)
      .send('ID de candidato inválido.');
  }

  if (!/^[A-Z]{2}$/.test(uf)) {
    return res
      .status(400)
      .send('UF inválida.');
  }

  /*
   * 1. Procura a foto original
   */
  const originalFile = findPhotoFile(
    id,
    uf,
    office
  );

  if (!originalFile) {
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=300'
    );

    return res
      .status(404)
      .send('Foto local não encontrada.');
  }

  try {
    /*
     * 2. Primeiro tenta usar a versão
     *    que já foi processada.
     */
    let processedFile =
      findProcessedPhoto(
        id,
        uf,
        office
      );

    /*
     * 3. Se ainda não existe,
     *    remove o fundo agora.
     */
    if (!processedFile) {
      const outputFile =
        getOutputFile(
          id,
          uf,
          office
        );

      processedFile =
        await processBackground(
          originalFile,
          outputFile
        );
    }

    /*
     * 4. Retorna PNG transparente
     */
    res.setHeader(
      'Content-Type',
      'image/png'
    );

    /*
     * Cache longo porque o arquivo
     * processado não muda.
     */
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=604800, immutable'
    );

    return res
      .status(200)
      .send(
        await fs.promises.readFile(
          processedFile
        )
      );

  } catch (error) {
    console.error(
      '[BACKGROUND REMOVAL] erro:',
      error
    );

    return res
      .status(500)
      .send(
        'Não foi possível remover o fundo da foto.'
      );
  }
};