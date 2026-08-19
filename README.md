# Plurall Bot

Bot de automação para navegação na plataforma educacional Plurall.

## Requisitos

- Node.js 18 ou superior
- Duas contas autorizadas no Plurall

## Instalação

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm run install-browser
```

## Configuração

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Depois, abra o arquivo `.env` e informe os dados das contas:

```env
CONTA1_USUARIO=seu_usuario
CONTA1_SENHA=sua_senha
CONTA2_USUARIO=outro_usuario
CONTA2_SENHA=outra_senha
LIVRO_NOME=
HEADLESS=true
```

Para selecionar um livro automaticamente, preencha `LIVRO_NOME`. Para abrir o navegador durante o uso, altere `HEADLESS=false`.

## Uso

Execute:

```bash
npm start
```

Se as credenciais não estiverem no `.env`, o programa solicitará os dados no terminal.

## Teste

Para verificar a configuração sem acessar o Plurall, execute:

```bash
npm test
```

## Aviso

Use o projeto somente com contas autorizadas e de acordo com as regras da plataforma. Não compartilhe o arquivo `.env` nem suas senhas.

## Direitos autorais

Copyright © 2026 **Arthur Forster**. Todos os direitos reservados.

Este projeto é disponibilizado para uso autorizado. A cópia, redistribuição ou modificação do código depende da autorização do titular dos direitos.
