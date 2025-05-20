if (typeof window.carregarCidadesDefinida === 'undefined') {
    window.carregarCidadesDefinida = true;

    if (typeof window.carregarCidades !== 'function') {
        console.log("Definindo função carregarCidades de fallback com API");
        window.carregarCidades = function () {
            console.log("Usando função carregarCidades de fallback com API");
            const estadoSelecionado = document.getElementById('estado').value;
            const selectCidade = document.getElementById('Cidade');
            selectCidade.innerHTML = '<option value="">Selecione uma cidade</option>';

            if (estadoSelecionado === 'MA') {
                const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios';

                fetch(url)
                    .then(response => response.json())
                    .then(cidades => {
                        cidades.sort((a, b) => a.nome.localeCompare(b.nome));

                        cidades.forEach(cidade => {
                            const option = document.createElement('option');
                            option.value = cidade.id;
                            option.textContent = cidade.nome;
                            selectCidade.appendChild(option);
                        });
                    }).catch(error => {
                        console.error('Erro ao carregar as cidades:', error);
                        selectCidade.innerHTML = '<option value="">Erro ao carregar cidades</option>';
                    });
            }
        }
    }
}

// Definição das constantes para os indicadores sociais
const INDICADORES = {
    POPULACAO: 'população',
    RENDA: 'renda',
    ESCOLARIDADE: 'educacao',
    SANEAMENTO: 'saneamento',
    IDADE: 'idade'
};

// Dados para cada indicador: agregado, variável e período
const CONFIG_INDICADORES = {
    [INDICADORES.RENDA]: {
        nome: 'Renda média per capita',
        agregado: '5938', // PIB Municipal 
        variavel: '9356', // Valor do rendimento nominal médio per capita
        periodo: 'ultimo', // Último período disponível
        localidade: '6', // Nível de localidade: município
        unidade: 'R$',
        estadoFallback: true // Se não houver dados municipais, usar dados estaduais
    },
    [INDICADORES.ESCOLARIDADE]: {
        nome: 'Taxa de frequência escolar',
        agregado: '10056', // Taxa de frequência escolar bruta
        variavel: '3795', // Taxa de frequência escolar bruta
        periodo: '2022',
        localidade: '6', // Nível de localidade: município também é suportado
        classificacao: '58[all]|86[95251]', // Classificação por grupo de idade e cor/raça total
        unidade: '%',
        apenasEstado: false, // Indicador disponível por município também
        grupoPorIdade: true // Indicador que usa grupos de idade
    },
    [INDICADORES.IDADE]: {
        nome: 'População por idade',
        agregado: '1209', // População estimada por grupos de idade
        variavel: '606', // População residente
        periodo: '2022', // Período específico
        localidade: '3', // Nível de localidade: UF (Estado)
        unidade: 'pessoas',
        apenasEstado: true // Indicador disponível apenas a nível estadual
    },
    [INDICADORES.SANEAMENTO]: {
        nome: 'Acesso ao saneamento básico',
        agregado: '1552', // Censo Demográfico 2010 - Domicílios
        variavel: '1498', // Percentual de domicílios com esgotamento sanitário
        periodo: 'ultimo',
        localidade: '6',
        unidade: '%',
        estadoFallback: true
    },
    [INDICADORES.POPULACAO]: {
        nome: 'População Total',
        agregado: '6579', // Estimativas populacionais
        variavel: '9324', // População residente estimada
        periodo: 'ultimo',
        localidade: '6',
        unidade: 'habitantes',
        estadoFallback: false
    }
};

// Função para exibir o overlay de carregamento
function showLoadingOverlay() {
    const overlay = document.getElementById('chart-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

// Função para esconder o overlay de carregamento
function hideLoadingOverlay() {
    const overlay = document.getElementById('chart-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Função para buscar dados de um indicador específico
async function buscarDadosIndicador(indicador, localidadeId = null) {
    console.log(`Buscando dados para o indicador: ${indicador}`);

    // Mostra o overlay de carregamento
    showLoadingOverlay();

    try {
        const config = CONFIG_INDICADORES[indicador];
        if (!config) {
            console.error(`Configuração não encontrada para o indicador: ${indicador}`);
            hideLoadingOverlay();
            return [];
        }

        // Verifica se é necessário buscar dados para o estado inteiro ou apenas para um município
        let nivel = localidadeId ? 'municipios' : 'estados';
        let localidades = localidadeId ? localidadeId : '21'; // 21 é o código do Maranhão

        // Monta a URL para a API de agregados do IBGE
        let url = `https://servicodados.ibge.gov.br/api/v3/agregados/${config.agregado}/periodos/${config.periodo}/variaveis/${config.variavel}?localidades=${nivel}[${localidades}]`;

        console.log('URL da API:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Dados recebidos:', data);

        // Verificar se temos dados válidos
        if (!data || !Array.isArray(data) || data.length === 0 || !data[0]?.resultados || data[0].resultados.length === 0) {
            console.log(`Sem dados para o indicador ${indicador}. Tentando fallback...`);

            // Se não temos dados municipais e fallback está habilitado, tenta buscar dados estaduais
            if (localidadeId && config.estadoFallback) {
                console.log('Buscando dados estaduais como fallback');
                hideLoadingOverlay();
                return buscarDadosIndicador(indicador, null);
            }

            // Se já estamos tentando dados estaduais, ou fallback não está habilitado, retornamos dados simulados
            if (!localidadeId || !config.estadoFallback) {
                console.log('Usando dados simulados como último recurso');
                hideLoadingOverlay();
                return gerarDadosSimulados(indicador);
            }

            hideLoadingOverlay();
            return [];
        }

        // Processamento dos dados para o formato esperado pelo gráfico
        const resultados = data[0].resultados[0];
        const series = resultados.series;

        if (!series) {
            console.log('Estrutura de séries não encontrada nos dados');
            hideLoadingOverlay();
            return gerarDadosSimulados(indicador);
        }

        const localidadesData = Object.entries(series);

        // Se não temos dados nas séries
        if (localidadesData.length === 0) {
            console.log('Não há dados nas séries');
            hideLoadingOverlay();
            return gerarDadosSimulados(indicador);
        }

        // Se for dados do estado todo, mas estamos buscando por município
        if (nivel === 'estados' && localidadeId) {
            // Retorna dados do estado com o nome do município selecionado
            const cidadeSelecionada = document.getElementById('Cidade').options[document.getElementById('Cidade').selectedIndex].text;

            // Verificar se temos algum valor
            const periodoChave = Object.keys(localidadesData[0][1])[0]; // Pega a primeira chave de período
            const valorEstado = parseFloat(localidadesData[0][1][periodoChave]) || 0;

            hideLoadingOverlay();
            return [{
                cidade: cidadeSelecionada,
                valor: valorEstado,
                unidade: config.unidade,
                isEstadoData: true // Flag para indicar que é dado estadual
            }];
        }

        // Se for dados do estado todo
        if (nivel === 'estados') {
            // Buscando 10 maiores municípios para exibir dados estaduais para cada um
            const topCidades = dadosGrafico.map(d => d.cidade);

            // Verificar se temos algum valor
            const periodoChave = Object.keys(localidadesData[0][1])[0]; // Pega a primeira chave de período
            const valorEstado = parseFloat(localidadesData[0][1][periodoChave]) || 0;

            hideLoadingOverlay();
            return topCidades.map(cidade => ({
                cidade,
                valor: valorEstado,
                unidade: config.unidade,
                isEstadoData: true
            }));
        }

        // Caso contrário, tenta extrair dados municipais
        let dadosTratados = [];

        try {
            if (Array.isArray(localidadeId) || localidadeId.includes(',')) {
                // Se buscamos vários municípios de uma vez
                const municipiosIDs = Array.isArray(localidadeId) ? localidadeId : localidadeId.split(',');

                for (const [localId, valores] of localidadesData) {
                    const municipioId = localId.split('|')[0] || localId;
                    const periodoChave = Object.keys(valores)[0];
                    const valor = parseFloat(valores[periodoChave]) || 0;

                    // Buscar nome do município pelo ID
                    const nomeMunicipio = await getNomeMunicipio(municipioId);

                    dadosTratados.push({
                        cidade: nomeMunicipio,
                        valor: valor,
                        unidade: config.unidade
                    });
                }
            } else {
                // Se buscamos um único município
                const municipioId = localidadeId;

                // Se não encontrar dados para o município específico, pode ser que esteja em outro formato
                if (localidadesData.length === 0) {
                    hideLoadingOverlay();
                    return gerarDadosSimulados(indicador);
                }

                const periodoChave = Object.keys(localidadesData[0][1])[0];
                const valor = parseFloat(localidadesData[0][1][periodoChave]) || 0;

                // Buscar nome do município pelo ID
                const nomeMunicipio = await getNomeMunicipio(municipioId);

                dadosTratados = [{
                    cidade: nomeMunicipio,
                    valor: valor,
                    unidade: config.unidade
                }];
            }
        } catch (dataProcessingError) {
            console.error('Erro ao processar dados:', dataProcessingError);
            hideLoadingOverlay();
            return gerarDadosSimulados(indicador);
        }

        hideLoadingOverlay();
        return dadosTratados;

    } catch (error) {
        console.error(`Erro ao buscar dados para ${indicador}:`, error);
        hideLoadingOverlay();
        return gerarDadosSimulados(indicador);
    }
}

// Função auxiliar para obter o nome do município pelo ID
async function getNomeMunicipio(municipioId) {
    try {
        // Primeiro verifica se podemos obter do select
        const option = document.querySelector(`#Cidade option[value="${municipioId}"]`);
        if (option) {
            return option.textContent;
        }

        // Se não, busca na API do IBGE
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipioId}`);
        if (response.ok) {
            const data = await response.json();
            return data.nome;
        }

        // Se tudo falhar, retorna o próprio ID
        return `Município ${municipioId}`;
    } catch (error) {
        console.error('Erro ao buscar nome do município:', error);
        return `Município ${municipioId}`;
    }
}

// Função para gerar dados simulados quando a API falha
function gerarDadosSimulados(indicador) {
    console.log(`Gerando dados simulados para o indicador: ${indicador}`);
    const config = CONFIG_INDICADORES[indicador];

    // Se for um município específico selecionado
    const cidadeSelecionada = document.getElementById('Cidade').selectedIndex > 0
        ? document.getElementById('Cidade').options[document.getElementById('Cidade').selectedIndex].text
        : null;

    if (cidadeSelecionada) {
        // Retorna dados simulados para o município selecionado
        let valorBase;
        switch (indicador) {
            case INDICADORES.RENDA:
                valorBase = 1200 + Math.random() * 800; // Entre R$ 1.200 e R$ 2.000
                break;
            case INDICADORES.ESCOLARIDADE:
                valorBase = 7 + Math.random() * 3; // Entre 7 e 10 anos
                break;
            case INDICADORES.SANEAMENTO:
                valorBase = 40 + Math.random() * 40; // Entre 40% e 80%
                break;
            default:
                valorBase = 50000 + Math.random() * 50000; // População entre 50 mil e 100 mil
        }

        return [{
            cidade: cidadeSelecionada,
            valor: valorBase,
            unidade: config.unidade,
            isSimulado: true
        }];
    }

    // Retorna dados simulados para os principais municípios
    return dadosGrafico.map(d => {
        let valorBase;
        switch (indicador) {
            case INDICADORES.RENDA:
                // Cidades maiores tendem a ter rendas maiores
                valorBase = 1000 + (Math.sqrt(d.valor) / 20);
                break;
            case INDICADORES.ESCOLARIDADE:
                // Correlação com tamanho da cidade
                valorBase = 7 + (Math.log10(d.valor) / 7);
                break;
            case INDICADORES.SANEAMENTO:
                // Correlação com tamanho da cidade
                valorBase = 40 + (Math.log10(d.valor) / 4);
                break;
            default:
                valorBase = d.valor;
        }

        return {
            cidade: d.cidade,
            valor: valorBase,
            unidade: config.unidade,
            isSimulado: true
        };
    });
}

// Função específica para buscar dados de população por idade
async function buscarDadosIdade() {
    console.log("Buscando dados de população por idade para o Maranhão");
    showLoadingOverlay();

    try {
        const config = CONFIG_INDICADORES[INDICADORES.IDADE];

        // URL da API com a classificação por idade - usamos [all] para obter todas as faixas etárias
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${config.agregado}/periodos/${config.periodo}/variaveis/${config.variavel}?localidades=N3[21]&classificacao=58[all]`;

        console.log('URL da API para dados de idade:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Dados de idade recebidos:', data);

        // Verificar se temos dados válidos
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log('Sem dados de idade. Gerando dados simulados.');
            hideLoadingOverlay();
            return gerarDadosIdadeSimulados();
        }

        // Processamento dos dados por faixa etária
        const dadosPorIdade = [];

        try {
            // Verificamos todos os resultados - cada um representa uma faixa etária
            const resultados = data[0].resultados;

            if (!resultados || resultados.length === 0) {
                throw new Error('Estrutura de resultados não encontrada nos dados');
            }

            // Para cada resultado (que representa uma faixa etária)
            for (const resultado of resultados) {
                // Pulamos o "Total" e "Idade ignorada"
                if (!resultado.classificacoes || !resultado.classificacoes[0] || !resultado.classificacoes[0].categoria) {
                    continue;
                }

                const categoria = resultado.classificacoes[0].categoria;
                const codigo = Object.keys(categoria)[0];
                const nomeFaixaEtaria = categoria[codigo];

                // Pulamos "Total" e "Idade ignorada" que não precisamos no gráfico
                if (nomeFaixaEtaria === 'Total' || nomeFaixaEtaria === 'Idade ignorada') {
                    continue;
                }

                // Se temos uma faixa etária válida, extraímos o valor
                if (resultado.series && resultado.series.length > 0) {
                    const localidade = Object.keys(resultado.series[0].serie)[0];
                    const valor = resultado.series[0].serie[localidade];

                    // Só adicionamos se o valor for válido (não for "...")
                    if (valor && valor !== '...') {
                        dadosPorIdade.push({
                            cidade: nomeFaixaEtaria, // Usamos a faixa etária como "cidade"
                            valor: parseFloat(valor) || 0,
                            unidade: config.unidade,
                            isEstadoData: true,
                            codigo: codigo // Armazenamos o código para ordenação posterior
                        });
                    }
                }
            }

            // Ordenação personalizada para as faixas etárias
            const ordemPersonalizada = {
                '1140': 1,  // 0 a 4 anos
                '1141': 2,  // 5 a 9 anos
                '1142': 3,  // 10 a 14 anos
                '1143': 4,  // 15 a 19 anos
                '2792': 5,  // 15 a 17 anos
                '92982': 6, // 18 e 19 anos
                '1144': 7,  // 20 a 24 anos
                '1145': 8,  // 25 a 29 anos
                '3299': 9,  // 30 a 39 anos
                '3300': 10, // 40 a 49 anos
                '3301': 11, // 50 a 59 anos
                '3520': 12, // 60 a 69 anos
                '3244': 13  // 70 anos ou mais
            };

            // Ordenar as faixas etárias
            dadosPorIdade.sort((a, b) => {
                return (ordemPersonalizada[a.codigo] || 99) - (ordemPersonalizada[b.codigo] || 99);
            });

            // Removemos os subgrupos "15 a 17 anos" e "18 e 19 anos" para evitar duplicidade com "15 a 19 anos"
            const dadosFiltrados = dadosPorIdade.filter(item =>
                item.codigo !== '2792' && item.codigo !== '92982'
            );

        } catch (error) {
            console.error('Erro ao processar dados de idade:', error);
            hideLoadingOverlay();
            return gerarDadosIdadeSimulados();
        }

        // Se não conseguimos extrair dados, retornamos simulados
        if (dadosPorIdade.length === 0) {
            console.log('Não foi possível extrair dados de idade. Gerando dados simulados.');
            hideLoadingOverlay();
            return gerarDadosIdadeSimulados();
        }

        hideLoadingOverlay();
        return dadosPorIdade;

    } catch (error) {
        console.error('Erro ao buscar dados de idade:', error);
        hideLoadingOverlay();
        return gerarDadosIdadeSimulados();
    }
}

// Função para gerar dados simulados de população por idade
function gerarDadosIdadeSimulados() {
    // Faixas etárias padrão
    const faixasEtarias = [
        '0 a 4 anos',
        '5 a 9 anos',
        '10 a 14 anos',
        '15 a 19 anos',
        '20 a 24 anos',
        '25 a 29 anos',
        '30 a 34 anos',
        '35 a 39 anos',
        '40 a 49 anos',
        '50 a 59 anos',
        '60 a 69 anos',
        '70 anos ou mais'
    ];

    // Distribuição aproximada baseada em dados típicos de população brasileira
    const distribuicao = [0.07, 0.08, 0.09, 0.09, 0.08, 0.08, 0.08, 0.07, 0.12, 0.1, 0.08, 0.06];

    // População total do Maranhão (aproximada)
    const populacaoTotal = 7000000;

    return faixasEtarias.map((faixa, index) => ({
        cidade: faixa,
        valor: Math.round(populacaoTotal * distribuicao[index]),
        unidade: 'pessoas',
        isSimulado: true,
        isEstadoData: true
    }));
}

// Função específica para buscar dados de taxa de frequência escolar bruta por faixa etária
async function buscarDadosFrequenciaEscolar() {
    console.log("Buscando dados de taxa de frequência escolar por grupo de idade para o Maranhão");
    showLoadingOverlay();

    try {
        const config = CONFIG_INDICADORES[INDICADORES.ESCOLARIDADE];

        // URL da API com a classificação por idade e cor/raça total
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${config.agregado}/periodos/${config.periodo}/variaveis/${config.variavel}?localidades=N3[21]&classificacao=58[all]|86[95251]`;

        console.log('URL da API para dados de frequência escolar:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Dados de frequência escolar recebidos:', data);

        // Verificar se temos dados válidos
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log('Sem dados de frequência escolar. Gerando dados simulados.');
            hideLoadingOverlay();
            return gerarDadosFrequenciaEscolarSimulados();
        }

        // Processamento dos dados por faixa etária
        const dadosPorGrupoIdade = [];

        try {
            // Para cada resultado (que representa uma faixa etária)
            const resultados = data[0].resultados;

            if (!resultados || resultados.length === 0) {
                throw new Error('Estrutura de resultados não encontrada nos dados');
            }

            for (const resultado of resultados) {
                // Verificamos se temos as classificações necessárias
                if (!resultado.classificacoes || resultado.classificacoes.length < 1) {
                    continue;
                }

                // Obtemos a categoria de idade
                const grupoCategorias = resultado.classificacoes.find(c => c.id === '58');
                if (!grupoCategorias || !grupoCategorias.categoria) {
                    continue;
                }

                const categoria = grupoCategorias.categoria;
                const codigo = Object.keys(categoria)[0];
                const nomeGrupoIdade = categoria[codigo];

                // Ignoramos "Total" e categorias muito específicas como idade única
                if (nomeGrupoIdade === 'Total' ||
                    (nomeGrupoIdade.match(/^\d+ anos?$/) &&
                        nomeGrupoIdade !== '1 ano' &&
                        parseInt(nomeGrupoIdade) > 5)) {
                    continue;
                }

                // Extraímos o valor da taxa de frequência escolar
                if (resultado.series && resultado.series.length > 0) {
                    const periodoKey = Object.keys(resultado.series[0].serie)[0];
                    const valor = resultado.series[0].serie[periodoKey];

                    // Só adicionamos se o valor for válido
                    if (valor && valor !== '...') {
                        dadosPorGrupoIdade.push({
                            cidade: nomeGrupoIdade, // Usamos o grupo de idade como "cidade"
                            valor: parseFloat(valor.replace(',', '.')) || 0,
                            unidade: config.unidade,
                            isEstadoData: true,
                            codigo: codigo // Para ordenação posterior
                        });
                    }
                }
            }

            // Definição de ordenação personalizada para os grupos de idade
            const ordemPersonalizada = {
                '2483': 1,   // 0 ano
                '2484': 2,   // 1 ano
                '2485': 3,   // 2 anos
                '2486': 4,   // 3 anos
                '2487': 5,   // 4 anos
                '2488': 6,   // 5 anos
                '99749': 7,  // 0 a 3 anos
                '47813': 8,  // 4 a 5 anos
                '31615': 9,  // 6 a 14 anos
                '2792': 10,  // 15 a 17 anos
                '100052': 11, // 18 a 24 anos
                '108866': 12  // 25 anos ou mais
            };

            // Ordenar os grupos de idade
            dadosPorGrupoIdade.sort((a, b) => {
                return (ordemPersonalizada[a.codigo] || 99) - (ordemPersonalizada[b.codigo] || 99);
            });

            // Filtramos para mostrar apenas os grupos de idade mais significativos
            // Preferimos faixas como "0 a 3 anos" em vez de idades individuais
            const gruposPreferidos = [
                '99749',  // 0 a 3 anos
                '47813',  // 4 a 5 anos
                '31615',  // 6 a 14 anos
                '2792',   // 15 a 17 anos
                '100052', // 18 a 24 anos
                '108866'  // 25 anos ou mais
            ];

            // Se temos dados suficientes de grupos preferidos, usamos apenas eles
            const dadosGruposPreferidos = dadosPorGrupoIdade.filter(d => gruposPreferidos.includes(d.codigo));

            if (dadosGruposPreferidos.length >= 4) {
                hideLoadingOverlay();
                return dadosGruposPreferidos;
            }

        } catch (error) {
            console.error('Erro ao processar dados de frequência escolar:', error);
            hideLoadingOverlay();
            return gerarDadosFrequenciaEscolarSimulados();
        }

        // Se não conseguimos extrair dados, retornamos simulados
        if (dadosPorGrupoIdade.length === 0) {
            console.log('Não foi possível extrair dados de frequência escolar. Gerando dados simulados.');
            hideLoadingOverlay();
            return gerarDadosFrequenciaEscolarSimulados();
        }

        hideLoadingOverlay();
        return dadosPorGrupoIdade;

    } catch (error) {
        console.error('Erro ao buscar dados de frequência escolar:', error);
        hideLoadingOverlay();
        return gerarDadosFrequenciaEscolarSimulados();
    }
}

// Função para gerar dados simulados de taxa de frequência escolar
function gerarDadosFrequenciaEscolarSimulados() {
    // Grupos de idade padrão
    const gruposIdade = [
        '0 a 3 anos',
        '4 a 5 anos',
        '6 a 14 anos',
        '15 a 17 anos',
        '18 a 24 anos',
        '25 anos ou mais'
    ];

    // Valores plausíveis para cada grupo de idade
    const valores = [
        29.21, // 0 a 3 anos - baixa frequência (creche)
        92.02, // 4 a 5 anos - alta frequência (pré-escola)
        98.44, // 6 a 14 anos - quase universal (ensino fundamental)
        84.77, // 15 a 17 anos - menor (ensino médio)
        24.29, // 18 a 24 anos - baixa (superior)
        5.61   // 25 anos ou mais - muito baixa
    ];

    // Pequena variação aleatória para não parecer totalmente fabricado
    return gruposIdade.map((grupo, index) => ({
        cidade: grupo,
        valor: valores[index] * (0.95 + Math.random() * 0.1), // Variação de ±5%
        unidade: '%',
        isSimulado: true,
        isEstadoData: true
    }));
}

// Função para buscar dados de frequência escolar para um município específico
async function buscarDadosFrequenciaEscolarPorMunicipio(municipioId) {
    console.log(`Buscando dados de frequência escolar para o município ${municipioId}`);
    showLoadingOverlay();

    try {
        const config = CONFIG_INDICADORES[INDICADORES.ESCOLARIDADE];

        // URL da API com a classificação por idade e cor/raça total para o município específico
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${config.agregado}/periodos/${config.periodo}/variaveis/${config.variavel}?localidades=N6[${municipioId}]&classificacao=58[all]|86[95251]`;

        console.log('URL da API para dados de frequência escolar por município:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Dados de frequência escolar por município recebidos:', data);

        // Verificar se temos dados válidos
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log('Sem dados de frequência escolar para o município. Tentando dados estaduais.');
            hideLoadingOverlay();
            return buscarDadosFrequenciaEscolar(); // Fallback para dados estaduais
        }

        // Processamento dos dados por faixa etária para o município
        const dadosPorGrupoIdade = [];

        try {
            // Para cada resultado (que representa uma faixa etária)
            const resultados = data[0].resultados;

            if (!resultados || resultados.length === 0) {
                throw new Error('Estrutura de resultados não encontrada nos dados');
            }

            // Obtemos o nome do município dos dados
            let nomeMunicipio = '';
            if (resultados[0]?.series && resultados[0].series.length > 0) {
                nomeMunicipio = resultados[0].series[0].localidade.nome;
            } else {
                // Se não conseguimos obter o nome, usamos o selecionado no dropdown
                nomeMunicipio = document.querySelector(`#Cidade option[value="${municipioId}"]`)?.textContent || `Município ${municipioId}`;
            }

            for (const resultado of resultados) {
                // Verificamos se temos as classificações necessárias
                if (!resultado.classificacoes || resultado.classificacoes.length < 1) {
                    continue;
                }

                // Obtemos a categoria de idade
                const grupoCategorias = resultado.classificacoes.find(c => c.id === '58');
                if (!grupoCategorias || !grupoCategorias.categoria) {
                    continue;
                }

                const categoria = grupoCategorias.categoria;
                const codigo = Object.keys(categoria)[0];
                const nomeGrupoIdade = categoria[codigo];

                // Ignoramos "Total" e categorias muito específicas como idade única
                if (nomeGrupoIdade === 'Total' ||
                    (nomeGrupoIdade.match(/^\d+ anos?$/) &&
                        nomeGrupoIdade !== '1 ano' &&
                        parseInt(nomeGrupoIdade) > 5)) {
                    continue;
                }

                // Extraímos o valor da taxa de frequência escolar
                if (resultado.series && resultado.series.length > 0) {
                    const periodoKey = Object.keys(resultado.series[0].serie)[0];
                    const valor = resultado.series[0].serie[periodoKey];

                    // Só adicionamos se o valor for válido
                    if (valor && valor !== '...') {
                        dadosPorGrupoIdade.push({
                            cidade: nomeGrupoIdade, // Usamos o grupo de idade como "cidade"
                            municipio: nomeMunicipio, // Guardamos o nome do município para referência
                            valor: parseFloat(valor.replace(',', '.')) || 0,
                            unidade: config.unidade,
                            isEstadoData: false, // Dados municipais
                            codigo: codigo // Para ordenação posterior
                        });
                    }
                }
            }

            // Definição de ordenação personalizada para os grupos de idade - mesma usada na função estadual
            const ordemPersonalizada = {
                '2483': 1,   // 0 ano
                '2484': 2,   // 1 ano
                '2485': 3,   // 2 anos
                '2486': 4,   // 3 anos
                '2487': 5,   // 4 anos
                '2488': 6,   // 5 anos
                '99749': 7,  // 0 a 3 anos
                '47813': 8,  // 4 a 5 anos
                '31615': 9,  // 6 a 14 anos
                '2792': 10,  // 15 a 17 anos
                '100052': 11, // 18 a 24 anos
                '108866': 12  // 25 anos ou mais
            };

            // Ordenar os grupos de idade
            dadosPorGrupoIdade.sort((a, b) => {
                return (ordemPersonalizada[a.codigo] || 99) - (ordemPersonalizada[b.codigo] || 99);
            });

            // Filtramos para mostrar apenas os grupos de idade mais significativos
            // Preferimos faixas como "0 a 3 anos" em vez de idades individuais
            const gruposPreferidos = [
                '99749',  // 0 a 3 anos
                '47813',  // 4 a 5 anos
                '31615',  // 6 a 14 anos
                '2792',   // 15 a 17 anos
                '100052', // 18 a 24 anos
                '108866'  // 25 anos ou mais
            ];

            // Se temos dados suficientes de grupos preferidos, usamos apenas eles
            const dadosGruposPreferidos = dadosPorGrupoIdade.filter(d => gruposPreferidos.includes(d.codigo));

            if (dadosGruposPreferidos.length >= 4) {
                hideLoadingOverlay();
                return dadosGruposPreferidos;
            }

            // Se não temos grupos preferidos suficientes, usamos todos os dados que temos
            if (dadosPorGrupoIdade.length > 0) {
                hideLoadingOverlay();
                return dadosPorGrupoIdade;
            }

        } catch (error) {
            console.error('Erro ao processar dados de frequência escolar por município:', error);
            hideLoadingOverlay();
            return buscarDadosFrequenciaEscolar(); // Fallback para dados estaduais
        }

        // Se não conseguimos extrair dados, tentamos dados estaduais
        console.log('Não foi possível extrair dados de frequência escolar por município. Tentando dados estaduais.');
        hideLoadingOverlay();
        return buscarDadosFrequenciaEscolar();

    } catch (error) {
        console.error('Erro ao buscar dados de frequência escolar por município:', error);
        hideLoadingOverlay();
        return buscarDadosFrequenciaEscolar(); // Fallback para dados estaduais
    }
}
document.addEventListener('DOMContentLoaded', function () {
    console.log("Dashboard principal iniciado");
    if (typeof window.graficoInicializado === 'undefined') {
        console.log("Inicializando fallback para cidades");

        if (document.getElementById('estado').value === 'MA') {
            carregarCidades();
        }

        document.getElementById('Cidade').addEventListener('change', function () {
            const cidadeSelecionada = this.options[this.selectedIndex].text;
            const cidadeId = this.value;
            console.log("Cidade selecionada:", cidadeSelecionada, cidadeId);

            // Busca dados do indicador selecionado para a cidade selecionada
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const checkbox of checkboxes) {
                if (checkbox.checked) {
                    // Tratamento especial para o indicador de frequência escolar
                    if (checkbox.id === INDICADORES.ESCOLARIDADE) {
                        buscarDadosFrequenciaEscolarPorMunicipio(cidadeId)
                            .then(dados => {
                                atualizarGrafico(dados, INDICADORES.ESCOLARIDADE);
                            });
                    }
                    // Tratamento especial para o indicador de idade (apenas estadual)
                    else if (checkbox.id === INDICADORES.IDADE) {
                        buscarDadosIdade()
                            .then(dados => {
                                // Adiciona o nome do município aos dados estaduais para contexto
                                const dadosComMunicipio = dados.map(d => ({
                                    ...d,
                                    municipio: cidadeSelecionada
                                }));
                                atualizarGrafico(dadosComMunicipio, INDICADORES.IDADE);
                            });
                    }
                    // Demais indicadores usam a busca padrão
                    else {
                        buscarDadosIndicador(checkbox.id, cidadeId)
                            .then(dados => {
                                atualizarGrafico(dados, checkbox.id);
                            });
                    }
                    break;
                }
            }
        });

        // Adiciona novos checkboxes para os indicadores solicitados
        const containerIndicadores = document.querySelector('.indicadores-styled');

        // Limpa os checkboxes extras existentes (para não duplicar)
        const checkboxesExtras = containerIndicadores.querySelectorAll('div:nth-child(n+4)');
        checkboxesExtras.forEach(div => div.remove());

        // Checkbox para idade
        const divIdade = document.createElement('div');
        divIdade.className = 'flex items-center';
        divIdade.innerHTML = `
            <input type="checkbox" id="idade" class="mr-2 md:mr-3 h-4 md:h-5 w-4 md:w-5 cursor-pointer"> 
            <label for="idade" class="ml-1 md:ml-2 text-sm md:text-lg cursor-pointer">População por Idade</label>
        `;
        containerIndicadores.appendChild(divIdade);

        // Checkbox para saneamento básico
        const divSaneamento = document.createElement('div');
        divSaneamento.className = 'flex items-center';
        divSaneamento.innerHTML = `
            <input type="checkbox" id="saneamento" class="mr-2 md:mr-3 h-4 md:h-5 w-4 md:w-5 cursor-pointer"> 
            <label for="saneamento" class="ml-1 md:ml-2 text-sm md:text-lg cursor-pointer">Acesso ao Saneamento Básico</label>
        `;
        containerIndicadores.appendChild(divSaneamento);
    }

    // grafico

    const dadosGrafico = [
        { cidade: 'São Luís', valor: 1108975 },
        { cidade: 'Imperatriz', valor: 258016 },
        { cidade: 'São José de Ribamar', valor: 176321 },
        { cidade: 'Timon', valor: 169107 },
        { cidade: 'Caxias', valor: 164224 },
        { cidade: 'Codó', valor: 122859 },
        { cidade: 'Paço do Lumiar', valor: 122197 },
        { cidade: 'Açailândia', valor: 111757 },
        { cidade: 'Bacabal', valor: 104633 },
        { cidade: 'Balsas', valor: 95929 }
    ];

    let graficoBarras;

    function desenharGraficoBarras(dados = dadosGrafico, titulo = 'População dos Municípios do Maranhão', labelY = 'População', indicador = INDICADORES.POPULACAO) {
        console.log("Desenhando gráfico de barras com Chart.js para", titulo);

        if (graficoBarras) {
            graficoBarras.destroy();
        }

        const config = CONFIG_INDICADORES[indicador];
        const ctx = document.getElementById('indicadores-chart').getContext('2d');
        const labels = dados.map(d => d.cidade);
        const valores = dados.map(d => d.valor);

        // Define cores com base no tipo de dado (estadual ou municipal)
        const backgroundColor = dados.some(d => d.isEstadoData) ? '#93c5fd' : '#60a5fa';
        const borderColor = dados.some(d => d.isEstadoData) ? '#60a5fa' : '#3b82f6';

        graficoBarras = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: config.nome,
                    data: valores,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderRadius: 3,
                    hoverBackgroundColor: dados.some(d => d.isEstadoData) ? '#bfdbfe' : '#93c5fd'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: titulo,
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        color: '#1e40af',
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let value = context.raw;
                                const unidade = config.unidade || '';
                                const formattedValue = unidade === 'R$'
                                    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    : value.toLocaleString('pt-BR') + ' ' + unidade;

                                let label = config.nome + ': ' + formattedValue;

                                // Adiciona aviso se for dado estadual
                                if (dados[context.dataIndex].isEstadoData) {
                                    label += ' (dados estaduais)';
                                }

                                return label;
                            }
                        }
                    },
                    legend: {
                        display: true
                    },
                    subtitle: {
                        display: dados.some(d => d.isEstadoData),
                        text: dados.some(d => d.isEstadoData) ? 'Dados disponíveis apenas a nível estadual' : '',
                        font: {
                            size: 12,
                            style: 'italic'
                        },
                        color: '#6b7280',
                        padding: {
                            bottom: 10
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: labelY + (config.unidade ? ` (${config.unidade})` : ''),
                            color: '#1e40af',
                            font: {
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: function (value) {
                                if (config.unidade === 'R$') {
                                    if (value >= 1000000) {
                                        return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                                    } else if (value >= 1000) {
                                        return 'R$ ' + (value / 1000).toFixed(0) + 'K';
                                    }
                                    return 'R$ ' + value;
                                } else {
                                    if (value >= 1000000) {
                                        return (value / 1000000).toFixed(1) + 'M';
                                    } else if (value >= 1000) {
                                        return (value / 1000).toFixed(0) + 'K';
                                    }
                                    return value;
                                }
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });

        // Mostra ou esconde a legenda de intensidade
        const legendaIndicador = document.getElementById('legenda-indicador');
        legendaIndicador.classList.remove('hidden');
        const legendaTitulo = document.getElementById('legenda-titulo');
        legendaTitulo.textContent = `Intensidade de ${config.nome.toLowerCase()}`;
    }

    // Função para atualizar o gráfico com base nos dados e indicador
    function atualizarGrafico(dados, indicador) {
        if (!dados || dados.length === 0) {
            alert('Não foram encontrados dados para este indicador.');
            return;
        }

        const config = CONFIG_INDICADORES[indicador];

        // Verificar se são dados simulados
        const saoSimulados = dados.some(d => d.isSimulado);

        // Se temos apenas um município, mostramos todos os indicadores para ele
        if (dados.length === 1) {
            const sufixo = saoSimulados ? ' (dados estimados)' :
                dados[0].isEstadoData ? ' (dados estaduais)' : '';

            desenharGraficoBarras(
                dados,
                `${config.nome} - ${dados[0].cidade}${sufixo}`,
                config.nome,
                indicador
            );

            // Exibir notificação se forem dados simulados
            if (saoSimulados) {
                exibirNotificacao('Aviso: Exibindo dados estimados devido à indisponibilidade na API do IBGE.');
            } else if (dados[0].isEstadoData) {
                exibirNotificacao('Aviso: Exibindo dados a nível estadual, pois não há dados municipais disponíveis.');
            }
        } else {
            // Ordenar por valor (decrescente) e pegar os 10 primeiros
            const dadosOrdenados = [...dados].sort((a, b) => b.valor - a.valor).slice(0, 10);

            const sufixo = saoSimulados ? ' (Dados Estimados)' :
                dadosOrdenados.some(d => d.isEstadoData) ? ' (Dados Estaduais)' : '';

            desenharGraficoBarras(
                dadosOrdenados,
                `${config.nome} dos Municípios do Maranhão${sufixo}`,
                config.nome,
                indicador
            );

            // Exibir notificação se forem dados simulados
            if (saoSimulados) {
                exibirNotificacao('Aviso: Exibindo dados estimados devido à indisponibilidade na API do IBGE.');
            } else if (dadosOrdenados.some(d => d.isEstadoData)) {
                exibirNotificacao('Aviso: Exibindo dados a nível estadual, pois não há dados municipais disponíveis.');
            }
        }
    }

    // Função para exibir notificação temporária
    function exibirNotificacao(mensagem) {
        // Verificar se já existe uma notificação
        let notificacao = document.getElementById('notificacao-api');

        if (!notificacao) {
            // Criar elemento de notificação
            notificacao = document.createElement('div');
            notificacao.id = 'notificacao-api';
            notificacao.className = 'fixed bottom-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-md max-w-md z-50 transition-opacity duration-500';
            notificacao.style.opacity = '0';

            // Botão de fechar
            const botaoFechar = document.createElement('button');
            botaoFechar.className = 'absolute top-2 right-2 text-yellow-700 hover:text-yellow-900';
            botaoFechar.innerHTML = '&times;';
            botaoFechar.onclick = function () {
                notificacao.style.opacity = '0';
                setTimeout(() => {
                    if (notificacao.parentNode) {
                        notificacao.parentNode.removeChild(notificacao);
                    }
                }, 500);
            };

            // Conteúdo
            const conteudo = document.createElement('div');

            // Adicionar ao documento
            notificacao.appendChild(botaoFechar);
            notificacao.appendChild(conteudo);
            document.body.appendChild(notificacao);
        }

        // Atualizar o conteúdo
        const conteudo = notificacao.querySelector('div');
        conteudo.textContent = mensagem;

        // Exibir com animação
        setTimeout(() => {
            notificacao.style.opacity = '1';
        }, 10);

        // Esconder após 5 segundos
        setTimeout(() => {
            notificacao.style.opacity = '0';
            setTimeout(() => {
                if (notificacao.parentNode) {
                    notificacao.parentNode.removeChild(notificacao);
                }
            }, 500);
        }, 5000);
    }

    // Inicialmente carrega o gráfico de população
    desenharGraficoBarras();

    window.addEventListener('resize', function () {
        // Redimensiona o gráfico atual
        if (graficoBarras) {
            graficoBarras.resize();
        }
    });

    // Adiciona eventos para os checkboxes de indicadores
    document.getElementById('população').addEventListener('change', function () {
        if (this.checked) {
            // Desmarca outros checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(#população)').forEach(cb => {
                cb.checked = false;
            });

            // Mostra o gráfico com dados populacionais
            desenharGraficoBarras(dadosGrafico, 'População dos Municípios do Maranhão', 'População', INDICADORES.POPULACAO);
        }
    });

    document.getElementById('renda').addEventListener('change', function () {
        if (this.checked) {
            // Desmarca outros checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(#renda)').forEach(cb => {
                cb.checked = false;
            });

            // Busca dados de renda para os 10 principais municípios
            buscarTop10Municipios(INDICADORES.RENDA)
                .then(dados => {
                    atualizarGrafico(dados, INDICADORES.RENDA);
                });
        }
    });

    document.getElementById('educacao').addEventListener('change', function () {
        if (this.checked) {
            // Desmarca outros checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(#educacao)').forEach(cb => {
                cb.checked = false;
            });

            // Busca dados de frequência escolar
            showLoadingOverlay();
            buscarDadosFrequenciaEscolar()
                .then(dados => {
                    atualizarGrafico(dados, INDICADORES.ESCOLARIDADE);
                });
        }
    });

    document.getElementById('saneamento').addEventListener('change', function () {
        if (this.checked) {
            // Desmarca outros checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(#saneamento)').forEach(cb => {
                cb.checked = false;
            });

            // Busca dados de saneamento para os 10 principais municípios
            buscarTop10Municipios(INDICADORES.SANEAMENTO)
                .then(dados => {
                    atualizarGrafico(dados, INDICADORES.SANEAMENTO);
                });
        }
    });

    // Adiciona evento para o botão de limpar filtros
document.getElementById('limparFiltros').addEventListener('click', function () {
    // Desmarca todos os checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Limpa o gráfico e restaura o estado inicial
    if (graficoBarras) {
        graficoBarras.destroy();
        graficoBarras = null;
    }
    
    // Esconde a legenda de intensidade
    const legendaIndicador = document.getElementById('legenda-indicador');
    if (legendaIndicador) {
        legendaIndicador.classList.add('hidden');
    }
    
    // Mostra uma mensagem no gráfico vazio
    const ctx = document.getElementById('indicadores-chart').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = "16px 'Poppins', sans-serif";
    ctx.fillStyle = "#4B5563";
    ctx.textAlign = "center";
    ctx.fillText("Selecione um indicador para visualizar o gráfico", ctx.canvas.width / 2, ctx.canvas.height / 2);
    
    exibirNotificacao('Filtros removidos. Selecione um indicador para visualizar dados.');
});

    // Marca o checkbox de população por padrão
    document.getElementById('população').checked = true;

    document.getElementById('idade').addEventListener('change', function () {
        if (this.checked) {
            // Desmarca outros checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(#idade)').forEach(cb => {
                cb.checked = false;
            });

            // Busca dados de distribuição por idade
            showLoadingOverlay();
            buscarDadosIdade()
                .then(dados => {
                    // Ordenar por faixa etária numérica
                    const dadosOrdenados = [...dados].sort((a, b) => {
                        // Extrai o primeiro número da faixa etária
                        const numA = parseInt(a.cidade.match(/\d+/)[0]);
                        const numB = parseInt(b.cidade.match(/\d+/)[0]);
                        return numA - numB;
                    });

                    atualizarGrafico(dadosOrdenados, INDICADORES.IDADE);
                });
        }
    });
});