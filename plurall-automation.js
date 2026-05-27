const { chromium } = require('playwright');
const readline = require('readline');

const PLURALL_LOGIN_URL = 'https://login.plurall.net/';
const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function fazerLogin(page, usuario, senha) {
    console.log(`[${usuario}] Acessando página de login do Plurall...`);
    await page.goto(PLURALL_LOGIN_URL);
    await page.waitForLoadState('networkidle');

    console.log(`[${usuario}] Preenchendo credenciais...`);
    await page.fill('input[placeholder*="usuário"], input[placeholder*="e-mail"], input[type="text"]', usuario);
    await page.fill('input[placeholder*="senha"], input[type="password"]', senha);

    await page.click('button:has-text("Entrar")');
    await page.waitForLoadState('networkidle');
    
    try {
        await page.waitForSelector('text=Atividades, text=Início', { timeout: 15000 });
        console.log(`[${usuario}] Login realizado com sucesso!`);
    } catch (e) {
        console.log(`[${usuario}] Alerta: Login pode ter falhado ou a página demorou a carregar.`);
    }
}

async function navegarParaAtividades(page, usuario) {
    console.log(`[${usuario}] Navegando para Atividades...`);
    await page.click('text=Atividades', { timeout: 15000 }).catch(() =>
        page.click('a:has-text("Atividades"), button:has-text("Atividades")')
    );
    await page.waitForTimeout(3000);

    console.log(`[${usuario}] Clicando em 'Aula dada, aula estudada'...`);
    await page.click('text=Aula dada, aula estudada', { timeout: 15000 }).catch(() =>
        page.click('a:has-text("Aula dada, aula estudada"), button:has-text("Aula dada, aula estudada")')
    );
    await page.waitForLoadState('networkidle');
    console.log(`[${usuario}] Navegação concluída!`);
}

async function listarESelecionarLivro(page, usuario) {
    console.log(`[${usuario}] Buscando livros disponíveis...`);
    await page.waitForSelector('div[class*="livro"], a[class*="book"], div[class*="card"]', { timeout: 15000 });
    
    const livros = await page.evaluate(() => {
        const elementos = document.querySelectorAll('div[class*="livro"], a[class*="book"], div[class*="card"]');
        return Array.from(elementos).map((el, index) => ({
            index: index + 1,
            titulo: el.innerText.split('\n')[0].trim() || `Livro ${index + 1}`
        })).filter(l => l.titulo.length > 0);
    });

    if (livros.length === 0) {
        console.log(`[${usuario}] Nenhum livro encontrado.`);
        return null;
    }

    console.log(`\n📚 Livros encontrados para ${usuario}:`);
    livros.forEach(l => console.log(`${l.index}. ${l.titulo}`));

    const escolha = await question(`\nDigite o número do livro que deseja selecionar para ${usuario}: `);
    const livroSelecionado = livros.find(l => l.index === parseInt(escolha));

    if (livroSelecionado) {
        console.log(`[${usuario}] Selecionando: ${livroSelecionado.titulo}...`);
        await page.click(`text=${livroSelecionado.titulo}`, { timeout: 15000 });
    } else {
        console.log(`[${usuario}] Opção inválida. Selecionando o primeiro disponível...`);
        await page.click('div[class*="livro"], a[class*="book"], div[class*="card"]', { timeout: 15000 });
    }
    
    await page.waitForLoadState('networkidle');
    console.log(`[${usuario}] Livro selecionado!`);
    return livroSelecionado ? livroSelecionado.titulo : 'Primeiro Livro';
}

async function responderQuestao(page, usuario, alternativa) {
    console.log(`[${usuario}] Selecionando alternativa ${alternativa}...`);
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
            await page.click(seletor, { timeout: 3000 });
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
    console.log(`[${usuario}] Confirmando resposta...`);
    try {
        await page.click('button:has-text("Confirmar"), button:has-text("Enviar"), button[type="submit"]', { timeout: 5000 });
    } catch (error) {
        console.log(`[${usuario}] Não encontrou botão de confirmar`);
    }

    await page.waitForTimeout(2000);
    return true;
}

async function verificarResposta(page) {
    const correta = await page.locator('text=Correto, text=Parabéns, div[class*="correct"]').count() > 0;
    const incorreta = await page.locator('text=Incorreto, text=Errado, div[class*="incorrect"]').count() > 0;
    return { correta, incorreta };
}

async function resolverQuestoesAlternadas(page1, page2, numeroQuestoes = 10) {
    console.log('\n=== INICIANDO RESOLUÇÃO DE QUESTÕES ===\n');
    for (let i = 0; i < numeroQuestoes; i++) {
        console.log(`\n--- Questão ${i + 1} ---`);
        let acertou = false;
        let tentativa = 0;

        while (!acertou && tentativa < ALTERNATIVAS.length) {
            const alternativa = ALTERNATIVAS[tentativa];
            const pageAtual = tentativa % 2 === 0 ? page1 : page2;
            const usuario = tentativa % 2 === 0 ? 'Conta 1' : 'Conta 2';

            console.log(`\nTentativa ${tentativa + 1} - ${usuario} chutando ${alternativa}`);
            await responderQuestao(pageAtual, usuario, alternativa);
            const resultado = await verificarResposta(pageAtual);

            if (resultado.correta) {
                console.log(`✓ ${usuario} ACERTOU com a alternativa ${alternativa}!`);
                acertou = true;
                const outraPage = tentativa % 2 === 0 ? page2 : page1;
                const outroUsuario = tentativa % 2 === 0 ? 'Conta 2' : 'Conta 1';
                console.log(`Sincronizando ${outroUsuario}...`);
                await responderQuestao(outraPage, outroUsuario, alternativa);
            } else {
                console.log(`✗ ${usuario} errou a alternativa ${alternativa}`);
            }
            tentativa++;
        }

        console.log('\nAvançando para próxima questão...');
        await Promise.all([
            page1.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {}),
            page2.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {})
        ]);
        await page1.waitForTimeout(3000);
    }
    console.log('\n=== RESOLUÇÃO CONCLUÍDA ===\n');
}

async function main() {
    console.log('🤖 Iniciando automação Plurall...\n');

    const user1 = await question('Digite o usuário da Conta 1: ');
    const pass1 = await question('Digite a senha da Conta 1: ');
    const user2 = await question('Digite o usuário da Conta 2: ');
    const pass2 = await question('Digite a senha da Conta 2: ');

    const browser = await chromium.launch({
        headless: true,
        slowMo: 100
    });

    try {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        console.log('\n📝 Fazendo login nas duas contas...\n');
        await Promise.all([
            fazerLogin(page1, user1, pass1),
            fazerLogin(page2, user2, pass2)
        ]);

        console.log('\n🔍 Navegando para atividades...\n');
        await Promise.all([
            navegarParaAtividades(page1, 'Conta 1'),
            navegarParaAtividades(page2, 'Conta 2')
        ]);

        console.log('\n📚 Selecionando livros...\n');
        // Selecionar livros sequencialmente para não bugar o input do terminal
        const livro1 = await listarESelecionarLivro(page1, 'Conta 1');
        const livro2 = await listarESelecionarLivro(page2, 'Conta 2');

        console.log(`\nLivros selecionados: ${livro1} e ${livro2}`);

        await page1.waitForTimeout(3000);
        await resolverQuestoesAlternadas(page1, page2, 10);
        console.log('\n✅ Automação finalizada com sucesso!');
    } catch (error) {
        console.error('\n❌ Erro durante a execução:', error.message);
    } finally {
        await browser.close();
        rl.close();
    }
}

main().catch(err => {
    console.error(err);
    rl.close();
    process.exit(1);
});
