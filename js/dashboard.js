if (typeof window.carregarCidadesDefinida === 'undefined') {
    window.carregarCidadesDefinida = true;
    
    if (typeof window.carregarCidades !== 'function') {
        console.log("Definindo função carregarCidades de fallback com API");
        window.carregarCidades = function() {
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
                    })                    .catch(error => {
                        console.error('Erro ao carregar as cidades:', error);
                        selectCidade.innerHTML = '<option value="">Erro ao carregar cidades</option>';
                    });
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard principal iniciado");    if (typeof window.graficoInicializado === 'undefined') {
        console.log("Inicializando fallback para cidades");
        
        if (document.getElementById('estado').value === 'MA') {
            carregarCidades();
        }

        document.getElementById('Cidade').addEventListener('change', function() {
            const cidadeSelecionada = this.options[this.selectedIndex].text;
            console.log("Cidade selecionada:", cidadeSelecionada);
        });
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
    
    function desenharGraficoBarras() {
        console.log("Desenhando gráfico de barras com Chart.js");        
        if (graficoBarras) {
            graficoBarras.destroy();
        }
        
        const ctx = document.getElementById('indicadores-chart').getContext('2d');        
        const labels = dadosGrafico.map(d => d.cidade);
        const valores = dadosGrafico.map(d => d.valor);
        graficoBarras = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'População',
                    data: valores,
                    backgroundColor: '#60a5fa',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 3,
                    hoverBackgroundColor: '#93c5fd'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'População dos Municípios do Maranhão',
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
                            label: function(context) {
                                let value = context.raw;
                                return 'População: ' + value.toLocaleString('pt-BR');
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'População',
                            color: '#1e40af',
                            font: {
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return (value / 1000000).toFixed(1) + 'M';
                                } else if (value >= 1000) {
                                    return (value / 1000).toFixed(0) + 'K';
                                }
                                return value;
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
    }
      desenharGraficoBarras();    window.addEventListener('resize', function() {
        desenharGraficoBarras();
    });    document.getElementById('população').addEventListener('change', function() {
        if (this.checked) {
            desenharGraficoBarras();
            document.getElementById('renda').checked = false;
            document.getElementById('educacao').checked = false;
        }
    });
    document.getElementById('população').checked = true;
    

});