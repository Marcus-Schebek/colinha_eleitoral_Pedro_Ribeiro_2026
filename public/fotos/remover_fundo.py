from pathlib import Path
from rembg import remove
from PIL import Image

# Pasta onde estão as imagens
PASTA_ENTRADA = Path("./")

# Pasta onde serão salvas as imagens sem fundo
PASTA_SAIDA = Path("imagens_sem_fundo")

# Extensões aceitas
EXTENSOES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}

# Cria a pasta de saída
PASTA_SAIDA.mkdir(exist_ok=True)

# Procura todas as imagens
imagens = [
    arquivo
    for arquivo in PASTA_ENTRADA.iterdir()
    if arquivo.is_file() and arquivo.suffix.lower() in EXTENSOES
]

print(f"Encontradas {len(imagens)} imagens.\n")

for arquivo in imagens:
    try:
        print(f"Processando: {arquivo.name}")

        # Abre a imagem
        imagem = Image.open(arquivo)

        # Remove o fundo
        imagem_sem_fundo = remove(imagem)

        # Sempre salva como PNG para preservar transparência
        nome_saida = arquivo.stem + ".png"
        caminho_saida = PASTA_SAIDA / nome_saida

        imagem_sem_fundo.save(caminho_saida, "PNG")

        print(f"  ✓ Salvo: {caminho_saida}")

    except Exception as erro:
        print(f"  ✗ Erro em {arquivo.name}: {erro}")

print("\nProcessamento concluído!")