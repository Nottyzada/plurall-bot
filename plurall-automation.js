require('dotenv').config();
const { chromium } = require('playwright');

// Configurações
const PLURALL_URL = 'https://www.plurall.net/';
const LIVRO_NOME = process.env.LIVRO_NOME || ''; // Nome do livro a ser selecionado

// Alternativas para chutar (A, B, C, D, E)
const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Realiza login na plataforma Plurall
 * @param {Object} page - Página do Playwright
 * @param {String} usuario - Nome de usuário
 * @param {String} senha - Senha
 */
async function fazerLogin(page, usuario, senha) {
    console.log(`[${usuario}] Acessando Plurall...`);
    await page.goto(PLURALL_URL);

    // Aguarda a página carregar
    await page.waitForLoadState('networkidle');

    // Procura e clica no botão de login
    console.log(`[${usuario}] Procurando botão de login...`);
    await page.click('text=Entrar', { timeout: 10000 }).catch(() =>
        page.click('button:has-text("Entrar")')
    );

    // Preenche credenciais
    console.log(`[${usuario}] Preenchendo credenciais...`);
    await page.fill('input[name="username"], input[type="text"], input[placeholder*="usu"], input[placeholder*="email"]', usuario);
    await page.fill('input[name="password"], input[type="password"], input[placeholder*="senha"]', senha);

    // Clica no botão de entrar/login
    await page.click('button[type="submit"], button:has-text("Entrar")');

    // Aguarda navegação após login
    await page.waitForLoadState('networkidle');
    console.log(`[${usuario}] Login realizado com sucesso!`);
}

/**
 * Navega até "Aula dada, aula estudada"
 * @param {Object} page - Página do Playwright
 * @param {String} usuario - Nome de usuário (para logs)
 */
async function navegarParaAtividades(page, usuario) {
    console.log(`[${usuario}] Navegando para Atividades...`);

    // Clica em "Atividades" no menu lateral
    await page.click('text=Atividades', { timeout: 10000 }).catch(() =>
        page.click('a:has-text("Atividades"), button:has-text("Atividades")')
    );

    await page.waitForTimeout(2000);

    // Clica em "Aula dada, aula estudada"
    console.log(`[${usuario}] Clicando em 'Aula dada, aula estudada'...`);
    await page.click('text=Aula dada, aula estudada', { timeout: 10000 }).catch(() =>
        page.click('a:has-text("Aula dada, aula estudada"), button:has-text("Aula dada, aula estudada")')
    );

    await page.waitForLoadState('networkidle');
    console.log(`[${usuario}] Navegação concluída!`);
}

/**
 * Seleciona o livro especificado
 * @param {Object} page - Página do Playwright
 * @param {String} usuario - Nome de usuário (para logs)
 * @param {String} nomeLivro - Nome do livro a selecionar
 */
async function selecionarLivro(page, usuario, nomeLivro) {
    if (!nomeLivro) {
        console.log(`[${usuario}] Nenhum livro especificado. Selecionando o primeiro disponível...`);
        // Clica no primeiro livro disponível
        await page.click('div[class*="livro"], a[class*="book"], div[class*="card"]', { timeout: 10000 });
    } else {
        console.log(`[${usuario}] Selecionando livro: ${nomeLivro}...`);
        await page.click(`text=${nomeLivro}`, { timeout: 10000 });
    }

    await page.waitForLoadState('networkidle');
    console.log(`[${usuario}] Livro selecionado!`);
}

/**
 * Responde uma questão selecionando uma alternativa
 * @param {Object} page - Página do Playwright
 * @param {String} usuario - Nome de usuário (para logs)
 * @param {String} alternativa - Alternativa a selecionar (A, B, C, D, E)
 */
async function responderQuestao(page, usuario, alternativa) {
    console.log(`[${usuario}] Selecionando alternativa ${alternativa}...`);

    // Tenta diferentes seletores para encontrar a alternativa
    const seletores = [
        `text=${alternativa}`,
        `label:has-text("${alternativa}")`,
        `input[value="${alternativa}"]`,
        `button:has-text("${alternativa}")`,
        `div:has-text("${alternativa}")`
    ];

    let clicou = false;
    for (const seletor of seletores) {
        try {
            await page.click(seletor, { timeout: 2000 });
            clicou = true;
            break;
        } catch (error) {
            continue;
        }
    }

    if (!clicou) {
        console.log(`[${usuario}] Não foi possível clicar na alternativa ${alternativa}`);
        return false;
    }

    await page.waitForTimeout(1000);

    // Clica no botão de confirmar/enviar resposta
    console.log(`[${usuario}] Confirmando resposta...`);
    try {
        await page.click('button:has-text("Confirmar"), button:has-text("Enviar"), button[type="submit"]', { timeout: 5000 });
    } catch (error) {
        console.log(`[${usuario}] Não encontrou botão de confirmar`);
    }

    await page.waitForTimeout(2000);
    return true;
}

/**
 * Verifica se a questão foi respondida corretamente
 * @param {Object} page - Página do Playwright
 */
async function verificarResposta(page) {
    // Procura por indicadores de resposta correta/incorreta
    const correta = await page.locator('text=Correto, text=Parabéns, div[class*="correct"]').count() > 0;
    const incorreta = await page.locator('text=Incorreto, text=Errado, div[class*="incorrect"]').count() > 0;

    return { correta, incorreta };
}

/**
 * Processo principal de alternância entre contas
 * @param {Object} page1 - Página da conta 1
 * @param {Object} page2 - Página da conta 2
 * @param {Number} numeroQuestoes - Número de questões a resolver
 */
async function resolverQuestoesAlternadas(page1, page2, numeroQuestoes = 5) {
    console.log('\n=== INICIANDO RESOLUÇÃO DE QUESTÕES ===\n');

    for (let i = 0; i < numeroQuestoes; i++) {
        console.log(`\n--- Questão ${i + 1} ---`);

        let acertou = false;
        let tentativa = 0;

        // Tenta até 5 alternativas ou até acertar
        while (!acertou && tentativa < ALTERNATIVAS.length) {
            const alternativa = ALTERNATIVAS[tentativa];

            // Alterna entre conta 1 e conta 2
            const pageAtual = tentativa % 2 === 0 ? page1 : page2;
            const usuario = tentativa % 2 === 0 ? 'Conta 1' : 'Conta 2';

            console.log(`\nTentativa ${tentativa + 1} - ${usuario} chutando ${alternativa}`);

            await responderQuestao(pageAtual, usuario, alternativa);

            // Verifica se acertou
            const resultado = await verificarResposta(pageAtual);

            if (resultado.correta) {
                console.log(`✓ ${usuario} ACERTOU com a alternativa ${alternativa}!`);
                acertou = true;

                // Sincroniza a outra conta (também marca a resposta correta)
                const outraPage = tentativa % 2 === 0 ? page2 : page1;
                const outroUsuario = tentativa % 2 === 0 ? 'Conta 2' : 'Conta 1';
                console.log(`Sincronizando ${outroUsuario}...`);
                await responderQuestao(outraPage, outroUsuario, alternativa);
            } else {
                console.log(`✗ ${usuario} errou a alternativa ${alternativa}`);
            }

            tentativa++;
        }

        if (!acertou) {
            console.log(`⚠ Não foi possível acertar a questão ${i + 1} após todas as tentativas`);
        }

        // Avança para próxima questão
        console.log('\nAvançando para próxima questão...');
        await page1.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {});
        await page2.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {});

        await page1.waitForTimeout(2000);
        await page2.waitForTimeout(2000);
    }

    console.log('\n=== RESOLUÇÃO CONCLUÍDA ===\n');
}

/**
 * Função principal
 */
async function main() {
    console.log('🤖 Iniciando automação Plurall...\n');

    // Validação de credenciais
    if (!process.env.CONTA1_USUARIO || !process.env.CONTA1_SENHA) {
        console.error('❌ Erro: Credenciais da Conta 1 não configuradas no arquivo .env');
        process.exit(1);
    }

    if (!process.env.CONTA2_USUARIO || !process.env.CONTA2_SENHA) {
        console.error('❌ Erro: Credenciais da Conta 2 não configuradas no arquivo .env');
        process.exit(1);
    }

    // Inicia o navegador
    const browser = await chromium.launch({
        headless: false, // Mude para true se quiser rodar sem interface gráfica
        slowMo: 100 // Adiciona delay entre ações para melhor visualização
    });

    try {
        // Cria dois contextos (sessões) separados para as duas contas
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Login nas duas contas em paralelo
        console.log('📝 Fazendo login nas duas contas...\n');
        await Promise.all([
            fazerLogin(page1, process.env.CONTA1_USUARIO, process.env.CONTA1_SENHA),
            fazerLogin(page2, process.env.CONTA2_USUARIO, process.env.CONTA2_SENHA)
        ]);

        // Navega para atividades nas duas contas
        console.log('\n🔍 Navegando para atividades...\n');
        await Promise.all([
            navegarParaAtividades(page1, 'Conta 1'),
            navegarParaAtividades(page2, 'Conta 2')
        ]);

        // Seleciona livro nas duas contas
        console.log('\n📚 Selecionando livro...\n');
        await Promise.all([
            selecionarLivro(page1, 'Conta 1', LIVRO_NOME),
            selecionarLivro(page2, 'Conta 2', LIVRO_NOME)
        ]);

        // Aguarda um pouco antes de começar
        await page1.waitForTimeout(3000);

        // Resolve questões alternando entre as contas
        await resolverQuestoesAlternadas(page1, page2, 10);

        console.log('\n✅ Automação finalizada com sucesso!');

        // Aguarda um pouco antes de fechar
        await page1.waitForTimeout(5000);

    } catch (error) {
        console.error('\n❌ Erro durante a execução:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

// Executa o script
main().catch(console.error);
