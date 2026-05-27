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

async function fazerLogin(page, usuario, senha, idConta) {
    console.log(`[${idConta}] Acessando página de login do Plurall...`);
    await page.goto(PLURALL_LOGIN_URL);
    await page.waitForLoadState('networkidle');

    console.log(`[${idConta}] Preenchendo credenciais para: ${usuario}...`);
    try {
        await page.waitForSelector('input[type="text"], input[type="email"]', { timeout: 10000 });
        await page.fill('input[type="text"], input[type="email"]', usuario);
        await page.fill('input[type="password"]', senha);
        await page.click('button:has-text("Entrar")');
    } catch (err) {
        console.error(`[${idConta}] Erro ao preencher campos de login: ${err.message}`);
    }

    try {
        await page.waitForSelector('text=Atividades, text=Início, .user-name', { timeout: 20000 });
        console.log(`[${idConta}] Login realizado com sucesso!`);
        return true;
    } catch (e) {
        console.log(`[${idConta}] Alerta: Login pode ter falhado ou a página demorou a carregar.`);
        return false;
    }
}

async function navegarParaAtividades(page, idConta) {
    console.log(`[${idConta}] Navegando para Atividades...`);
    try {
        await page.waitForSelector('text=Atividades', { timeout: 15000 });
        await page.click('text=Atividades');
        
        await page.waitForTimeout(3000);
        console.log(`[${idConta}] Clicando em 'Aula dada, aula estudada'...`);
        await page.waitForSelector('text=Aula dada, aula estudada', { timeout: 15000 });
        await page.click('text=Aula dada, aula estudada');
        
        await page.waitForLoadState('networkidle');
        console.log(`[${idConta}] Navegação concluída!`);
    } catch (err) {
        console.error(`[${idConta}] Erro na navegação: ${err.message}`);
    }
}

async function listarLivros(page, idConta) {
    console.log(`[${idConta}] Buscando livros disponíveis...`);
    try {
        await page.waitForSelector('div[class*="livro"], a[class*="book"], div[class*="card"], .sc-kOHTFB', { timeout: 20000 });
        
        const livros = await page.evaluate(() => {
            // Seletores comuns no Plurall para cards de livros
            const elementos = document.querySelectorAll('div[class*="livro"], a[class*="book"], div[class*="card"], .sc-kOHTFB');
            return Array.from(elementos).map((el, index) => {
                const texto = el.innerText.trim().split('\n')[0];
                return {
                    index: index + 1,
                    titulo: texto || `Livro ${index + 1}`
                };
            }).filter(l => l.titulo.length > 2);
        });
        return livros;
    } catch (err) {
        console.error(`[${idConta}] Erro ao listar livros: ${err.message}`);
        return [];
    }
}

async function selecionarLivroPorNome(page, idConta, nomeLivro) {
    console.log(`[${idConta}] Selecionando: ${nomeLivro}...`);
    try {
        await page.click(`text=${nomeLivro}`, { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        console.log(`[${idConta}] Livro selecionado!`);
        return true;
    } catch (err) {
        console.log(`[${idConta}] Não foi possível clicar no livro pelo texto. Tentando clique genérico...`);
        await page.click('div[class*="livro"], a[class*="book"], div[class*="card"]', { timeout: 5000 }).catch(() => {});
        return false;
    }
}

async function responderQuestao(page, idConta, alternativa) {
    console.log(`[${idConta}] Selecionando alternativa ${alternativa}...`);
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

    if (!clicou) return false;

    await page.waitForTimeout(1000);
    try {
        await page.click('button:has-text("Confirmar"), button:has-text("Enviar"), button[type="submit"]', { timeout: 3000 });
    } catch (error) {}

    await page.waitForTimeout(2000);
    return true;
}

async function verificarResposta(page) {
    const correta = await page.locator('text=Correto, text=Parabéns, div[class*="correct"]').count() > 0;
    return { correta };
}

async function resolverQuestoesAlternadas(page1, page2, numQuestoes = 10) {
    console.log('\n=== INICIANDO RESOLUÇÃO DE QUESTÕES ===\n');
    for (let i = 0; i < numQuestoes; i++) {
        console.log(`\n--- Questão ${i + 1} ---`);
        let acertou = false;
        let tentativa = 0;

        while (!acertou && tentativa < ALTERNATIVAS.length) {
            const alternativa = ALTERNATIVAS[tentativa];
            const pageAtual = tentativa % 2 === 0 ? page1 : page2;
            const idConta = tentativa % 2 === 0 ? 'Conta 1' : 'Conta 2';

            console.log(`Tentativa ${tentativa + 1}: ${idConta} chutando ${alternativa}`);
            const respondeu = await responderQuestao(pageAtual, idConta, alternativa);
            
            if (respondeu) {
                const resultado = await verificarResposta(pageAtual);
                if (resultado.correta) {
                    console.log(`✓ ${idConta} ACERTOU com ${alternativa}!`);
                    acertou = true;
                    const outraPage = tentativa % 2 === 0 ? page2 : page1;
                    const outroId = tentativa % 2 === 0 ? 'Conta 2' : 'Conta 1';
                    console.log(`Sincronizando ${outroId} com a resposta correta...`);
                    await responderQuestao(outraPage, outroId, alternativa);
                } else {
                    console.log(`✗ ${idConta} errou.`);
                }
            }
            tentativa++;
        }

        console.log('Avançando...');
        await Promise.all([
            page1.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {}),
            page2.click('button:has-text("Próxima"), button:has-text("Avançar")').catch(() => {})
        ]);
        await page1.waitForTimeout(3000);
    }
}

async function main() {
    console.log('🤖 Plurall Bot - Iniciando...\n');

    const user1 = await question('Usuário Conta 1: ');
    const pass1 = await question('Senha Conta 1: ');
    const user2 = await question('Usuário Conta 2: ');
    const pass2 = await question('Senha Conta 2: ');

    const browser = await chromium.launch({ headless: true });

    try {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        console.log('\n🔐 Realizando login...');
        const login1 = await fazerLogin(page1, user1, pass1, 'Conta 1');
        const login2 = await fazerLogin(page2, user2, pass2, 'Conta 2');

        if (!login1 || !login2) {
            console.log('⚠️ Aviso: Um ou mais logins podem ter falhado.');
        }

        console.log('\n📂 Navegando...');
        await Promise.all([
            navegarParaAtividades(page1, 'Conta 1'),
            navegarParaAtividades(page2, 'Conta 2')
        ]);

        console.log('\n📚 Listando livros disponíveis na Conta 1...');
        const livros = await listarLivros(page1, 'Conta 1');
        
        if (livros.length === 0) {
            console.log('❌ Nenhum livro encontrado. Encerrando.');
            return;
        }

        livros.forEach(l => console.log(`${l.index}. ${l.titulo}`));
        const index = await question('\nDigite o número do livro desejado: ');
        const livroEscolhido = livros.find(l => l.index === parseInt(index));

        if (!livroEscolhido) {
            console.log('❌ Opção inválida.');
            return;
        }

        console.log(`\n📖 Selecionando "${livroEscolhido.titulo}" nas duas contas...`);
        await Promise.all([
            selecionarLivroPorNome(page1, 'Conta 1', livroEscolhido.titulo),
            selecionarLivroPorNome(page2, 'Conta 2', livroEscolhido.titulo)
        ]);

        await resolverQuestoesAlternadas(page1, page2, 15);
        console.log('\n✅ Concluído!');

    } catch (err) {
        console.error('\n❌ Erro fatal:', err.message);
    } finally {
        await browser.close();
        rl.close();
    }
}

main().catch(err => {
    console.error(err);
    rl.close();
});
