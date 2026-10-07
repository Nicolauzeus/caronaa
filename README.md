                                                              # Caronaa

Crie o MVP visual do aplicativo CARONAA (plataforma comunitária de caronas compartilhadas urbanas e intermunicipais).

Foco deste primeiro passo:

1. Design: Mobile-first moderno, limpo, paleta com verde/esmeralda e tons escuros/neutros de mobilidade e confiança, cantos arredondados e boa densidade de informação.
2. Navegação: Header simples e Bottom Navigation fixa para mobile com abas: Início, Buscar, Oferecer, Minhas Caronas e Perfil.
3. Páginas (todas navegáveis com dados mockados em um arquivo centralizado mockData.ts):
   - Landing pública ("/") com proposta de valor, CTA para buscar carona e banner para o formulário de validação.
   - Home ("/home") com busca rápida (origem, destino, data) e lista de caronas sugeridas.
   - Buscar Carona ("/buscar") com filtros rápidos e cards de motorista (foto, avaliação, trajeto, horário, vagas).
   - Oferecer Carona ("/oferecer") formulário passo a passo visual.
   - Minhas Caronas ("/minhas-caronas") com abas "Como passageiro" e "Como motorista".
   - Perfil ("/perfil") com resumo do usuário.
4. Rota reservada para o formulário: crie um botão de destaque "Validação Siará Tech Summit" levando para "/formulario" (deixe uma tela placeholder elegante para implementarmos no próximo passo).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a55d36f2-9ca3-417b-b6b0-2f968a65d3a2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
