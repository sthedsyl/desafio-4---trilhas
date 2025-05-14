// Função para carregar as cidades do Maranhão usando a API do IBGE
function carregarCidades() {
    const estadoSelecionado = document.getElementById('estado').value;
    const selectCidade = document.getElementById('Cidade');
    
    // Limpa as opções anteriores
    selectCidade.innerHTML = '<option value="">Selecione uma cidade</option>';
    
    if (estadoSelecionado === 'MA') {
        // URL da API do IBGE para buscar municípios do Maranhão 
        const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios';
        
        // Faz a requisição para a API
        fetch(url)
            .then(response => response.json())
            .then(cidades => {
                // Ordena as cidades por nome
                cidades.sort((a, b) => a.nome.localeCompare(b.nome));
                
                // Adiciona cada cidade como opção no select
                cidades.forEach(cidade => {
                    const option = document.createElement('option');
                    option.value = cidade.id;
                    option.textContent = cidade.nome;
                    selectCidade.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Erro ao carregar as cidades:', error);
                selectCidade.innerHTML = '<option value="">Erro ao carregar cidades</option>';
            });
    }
}

// Carrega as cidades automaticamente ao iniciar a página se Maranhão estiver selecionado
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('estado').value === 'MA') {
        carregarCidades();
    }
});