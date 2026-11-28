# Android: candidato assinado (F07/F08)

A chave permanente fica fora do repositório, com alias `caronaa-release` (PKCS12). Guardar backup protegido e senha separadamente. Nunca gerar uma nova chave para cada build.

Secrets do Actions:
- CARONAA_ANDROID_KEYSTORE_BASE64
- CARONAA_ANDROID_KEYSTORE_PASSWORD
- CARONAA_ANDROID_GOOGLE_SERVICES_JSON: conteúdo do google-services.json de cliente Android, projeto caronaa-app e pacote com.caronaa.app. Não usar JSON de conta de serviço nem private_key.

O workflow manual Android signed release candidate somente roda os jobs na main. Faz build release não assinado e testes, depois assina em job separado sem checkout do código. Verifica assinatura e pacote/versão e gera artefato com APK, SHA256SUMS.txt e version.json. Não anuncia nem publica o candidato em Releases.

O primeiro run usa versionCode 2 (run_number + 1); o número aumenta para cada nova execução, não para retry. Não recriar/resetar o workflow. Manter versionName novo para cada versão publicada. Builds debug continuam fora da distribuição oficial.

Antes de publicar: verificar certificado com a chave original, instalação limpa (debug anterior tem assinatura diferente), push real, botões de ação, tela bloqueada, logout e atualização entre dois APKs assinados com a mesma chave. A atualização por manifesto atual requer arquivo no domínio oficial de downloads, configuração CARONAA_ANDROID_RELEASE correspondente ao APK real e versionCode superior. O GitHub Releases pode servir de distribuição adicional após validação. Não anunciar candidato nem excluir builds antigos até a versão oficial validada estar disponível.

O workflow não implementa os botões nativos nem muda o contrato de F07/F08, tarifas, GPS, autorização ou dados. Ainda é preciso concluir e testar os botões e o resumo de origem/destino antes de publicar como versão oficial.
