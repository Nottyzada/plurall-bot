require('dotenv').config();
const { chromium } = require('playwright');
const readline = require('readline');

const PLURALL_LOGIN_URL = 'https://login.plurall.net/';
const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'];

let rl;

function getReadline() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    return rl;
}

function question(query) {
    return new Promise(resolve => getReadline().question(query, resolve));
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

        // Aplicar filtro de tarefas pendentes se solicitado
        console.log(`[${idConta}] Ativando filtro de tarefas pendentes...`);
        try {
            const filterSelector = '#check-disciplines-filter';
            await page.waitForSelector(filterSelector, { timeout: 5000 });
            const isChecked = await page.getAttribute(filterSelector, 'aria-checked');
            if (isChecked === 'false') {
                await page.click(filterSelector);
                console.log(`[${idConta}] Filtro 'Visualizar apenas tarefas para fazer' ativado.`);
            }
        } catch (e) {
            console.log(`[${idConta}] Filtro de tarefas pendentes não encontrado ou já aplicado.`);
        }

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

async function filtrarTarefasPendentes(page, idConta) {
    console.log(`[${idConta}] Filtrando apenas tarefas pendentes...`);
    try {
        // Seletor baseado no HTML fornecido: <div id="check-disciplines-filter" ...>
        const checkbox = await page.locator('#check-disciplines-filter');
        const isChecked = await checkbox.getAttribute('aria-checked');
        if (isChecked === 'false') {
            await checkbox.click();
        }
        await page.waitForTimeout(2000);
    } catch (err) {
        console.log(`[${idConta}] Erro ao aplicar filtro: ${err.message}`);
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
    // Melhoria na detecção de resposta correta baseada no HTML fornecido (.correct)
    const correta = await page.locator('text=Correto, text=Parabéns, div[class*="correct"], .correct').count() > 0;
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

async function obterConfiguracao() {
    const configuracao = {
        user1: process.env.CONTA1_USUARIO,
        pass1: process.env.CONTA1_SENHA,
        user2: process.env.CONTA2_USUARIO,
        pass2: process.env.CONTA2_SENHA,
        livroNome: process.env.LIVRO_NOME || '',
        headless: process.env.HEADLESS !== 'false'
    };

    const possuiCredenciais = [configuracao.user1, configuracao.pass1, configuracao.user2, configuracao.pass2]
        .every(valor => typeof valor === 'string' && valor.trim().length > 0);

    if (!possuiCredenciais) {
        configuracao.user1 = await question('Usuário Conta 1: ');
        configuracao.pass1 = await question('Senha Conta 1: ');
        configuracao.user2 = await question('Usuário Conta 2: ');
        configuracao.pass2 = await question('Senha Conta 2: ');
    }

    return configuracao;
}

async function main() {
    console.log('Plurall Bot - Iniciando...\n');

    const { user1, pass1, user2, pass2, livroNome, headless } = await obterConfiguracao();

    const browser = await chromium.launch({ headless });

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
        let livroEscolhido;
        if (livroNome.trim()) {
            livroEscolhido = livros.find(l => l.titulo.toLowerCase().includes(livroNome.trim().toLowerCase()));
            if (!livroEscolhido) {
                console.error(`Livro não encontrado: ${livroNome}`);
                return;
            }
        } else {
            const index = await question('\nDigite o número do livro desejado: ');
            livroEscolhido = livros.find(l => l.index === parseInt(index, 10));
        }

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

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        if (rl) rl.close();
        process.exitCode = 1;
    });
}

module.exports = {
    obterConfiguracao,
    fazerLogin,
    navegarParaAtividades,
    listarLivros,
    selecionarLivroPorNome,
    filtrarTarefasPendentes,
    verificarResposta
};
