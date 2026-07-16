# Onde colocar o APK

O botão **"Descarregar APK"** do site aponta para:

```
web/downloads/luxee.apk
```

## Como atualizar

1. Gera o APK:
   ```bash
   cd mobile
   eas build -p android --profile production
   ```
   (o `eas.json` já está configurado com `"buildType": "apk"`)

2. Descarrega o `.apk` do link que o EAS te dá.

3. Renomeia para `luxee.apk` e coloca-o **nesta pasta**.

4. Se mudares a versão, atualiza os dois sítios em `web/index.html`:
   - o bloco `.download-meta` → `<span>Versão 1.0.0</span>`
   - o JSON-LD no `<head>` → `"softwareVersion": "1.0.0"`

## Nota

Ficheiros `.apk` são grandes (dezenas de MB). Se usares Git, considera
[Git LFS](https://git-lfs.com/) ou aloja o APK num storage externo
(ex.: Cloudflare R2, que já usas na API) e troca o `href` do botão
em `index.html` pelo link direto.
