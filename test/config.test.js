const assert = require('node:assert/strict');
const { obterConfiguracao } = require('../plurall-automation');

async function main() {
    const original = {
        CONTA1_USUARIO: process.env.CONTA1_USUARIO,
        CONTA1_SENHA: process.env.CONTA1_SENHA,
        CONTA2_USUARIO: process.env.CONTA2_USUARIO,
        CONTA2_SENHA: process.env.CONTA2_SENHA,
        LIVRO_NOME: process.env.LIVRO_NOME,
        HEADLESS: process.env.HEADLESS
    };

    Object.assign(process.env, {
        CONTA1_USUARIO: 'usuario-1',
        CONTA1_SENHA: 'senha-1',
        CONTA2_USUARIO: 'usuario-2',
        CONTA2_SENHA: 'senha-2',
        LIVRO_NOME: 'Matemática',
        HEADLESS: 'false'
    });

    const config = await obterConfiguracao();
    assert.deepEqual(config, {
        user1: 'usuario-1',
        pass1: 'senha-1',
        user2: 'usuario-2',
        pass2: 'senha-2',
        livroNome: 'Matemática',
        headless: false
    });

    for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    console.log('Configuração: OK');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
