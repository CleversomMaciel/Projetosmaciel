# Golias — assistente por voz para Android

Assistente pessoal por voz, com visão pela câmera, que roda no Chrome do Android
e pode ser instalado na tela inicial como um app (PWA).

## Como publicar (uma vez só)

1. Junte esta branch na `master` (merge do pull request).
2. No GitHub, abra **Settings → Pages** do repositório e em **Source** escolha **GitHub Actions**.
3. A ação "Publicar Golias no GitHub Pages" roda sozinha. O endereço fica:
   `https://cleversommaciel.github.io/projetosmaciel/`

> Repositório privado só publica Pages em planos pagos do GitHub. Se for o caso,
> deixe o repositório público (a chave da API **não** fica no código, fica só no seu celular).

## Como usar no Android

1. Abra o endereço no **Chrome**.
2. Toque em **⚙** e cole sua chave da API da Anthropic
   (crie em <https://console.anthropic.com/settings/keys> e defina um limite de gasto).
3. Toque em **⤓** (ou menu do Chrome → *Instalar app*) para colocar o Golias na tela inicial.
4. Toque em **Ativar** e permita câmera, microfone, notificações e localização.
5. Diga "Golias, ..." e faça o pedido. Tocar na esfera ou no 🎤 também funciona, sem precisar do nome.

## O que ele faz

| Peça | Exemplo |
|---|---|
| Perguntas gerais | "Golias, quanto é 15% de 230?" |
| Ver pela câmera | "Golias, o que está escrito aqui?" |
| WhatsApp / SMS / ligar | "Golias, manda no WhatsApp pra Ana que vou atrasar" |
| Rota | "Golias, me leva pro aeroporto" |
| Timer | "Golias, timer de 10 minutos pro arroz" |
| Alarme | "Golias, me acorda às 6 e meia" |
| Lembrete na agenda | "Golias, lembra amanhã às 9 de pagar o boleto" |
| Lanterna | "Golias, liga a lanterna" |
| Clima | "Golias, vai chover hoje?" |
| Música / YouTube | "Golias, toca Tim Maia" |
| Memória | "Golias, o número da Ana é 11 99999-0000" |

## Limitações do navegador

- **Abrir outros apps** (WhatsApp, Maps, ligação) exige um toque seu: o Golias mostra um botão logo abaixo da resposta.
- **Timer e alarme** tocam pelo próprio app, então ele precisa ficar aberto (a tela é mantida acesa).
  No alarme aparece também o botão "Criar também no Relógio", que tenta criar no app Relógio do Android.
- **Ouvir o tempo todo**: o Chrome do Android faz um bip cada vez que o microfone religa.
  Se incomodar, desligue "Conversa contínua" e "Só responder quando eu disser o nome" e use o botão 🎤.
- O reconhecimento de voz do Chrome precisa de internet.

## Arquivos

- `index.html` — o app inteiro
- `manifest.webmanifest`, `sw.js`, `icons/` — instalação como app e funcionamento offline
- `../.github/workflows/golias-pages.yml` — publicação automática no GitHub Pages
