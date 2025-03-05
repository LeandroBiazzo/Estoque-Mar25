// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbyua0rj7RY4QI23J8wo66SFCaI6H6RV_y-zV1VMjqHCcddSKfA/exec';
let appData = {
    produtos: [],
    entradas: [],
    saidas: [],
    locais: [],
    usuarios: [],
    saldo: []
};
let isOffline = !navigator.onLine;

// DOM Elements
const offlineBanner = document.getElementById('offline-banner');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Setup navigation
    setupNavigation();
    
    // Load data
    loadAllData();
    
    // Setup forms
    setupProductForm();
    setupEntryForm();
    setupOutputForm();
    
    // Check for offline status
    updateOfflineStatus();
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
});

// Navigation
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(link => link.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get section id
            const sectionId = link.getAttribute('data-section');
            
            // Hide all sections
            sections.forEach(section => section.classList.remove('active'));
            
            // Show selected section
            let sectionElement;
            switch(sectionId) {
                case 'home':
                    sectionElement = document.getElementById('home-section');
                    break;
                case 'products':
                    sectionElement = document.getElementById('products-section');
                    refreshProductsTable();
                    break;
                case 'entries':
                    sectionElement = document.getElementById('entries-section');
                    refreshEntriesTable();
                    break;
                case 'outputs':
                    sectionElement = document.getElementById('outputs-section');
                    refreshOutputsTable();
                    break;
                case 'balance':
                    sectionElement = document.getElementById('balance-section');
                    refreshBalanceTable();
                    break;
            }
            
            if (sectionElement) {
                sectionElement.classList.add('active');
            }
        });
    });
}

// Data Loading
function loadAllData() {
    showToast('Carregando dados...', 'text-primary');
    
    fetch(`${API_URL}?action=getAll`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                appData = data.data;
                updateDashboard();
                refreshProductsTable();
                refreshEntriesTable();
                refreshOutputsTable();
                refreshBalanceTable();
                
                // Populate dropdowns
                populateProductDropdowns();
                populateLocationDropdowns();
                populateUserDropdowns();
                
                showToast('Dados carregados com sucesso!', 'text-success');
            } else {
                throw new Error(data.message || 'Erro ao carregar dados');
            }
        })
        .catch(error => {
            console.error('Error loading data:', error);
            showToast('Erro ao carregar dados. Verifique sua conexão.', 'text-danger');
            
            // If offline, try to load from cache
            if (isOffline) {
                const cachedData = localStorage.getItem('appData');
                if (cachedData) {
                    appData = JSON.parse(cachedData);
                    updateDashboard();
                    refreshProductsTable();
                    refreshEntriesTable();
                    refreshOutputsTable();
                    refreshBalanceTable();
                    showToast('Usando dados em cache (offline)', 'text-warning');
                }
            }
        });
}

// Dashboard
function updateDashboard() {
    // Total Products
    document.getElementById('total-produtos').textContent = appData.produtos.length;
    
    // Current month entries
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const entriesThisMonth = appData.entradas.filter(entrada => {
        const entryDate = new Date(entrada.Data_Entrada);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });
    
    document.getElementById('total-entradas').textContent = entriesThisMonth.length;
    
    // Current month outputs
    const outputsThisMonth = appData.saidas.filter(saida => {
        const outputDate = new Date(saida.Data_Saída || saida.Data_Saida);
        return outputDate.getMonth() === currentMonth && outputDate.getFullYear() === currentYear;
    });
    
    document.getElementById('total-saidas').textContent = outputsThisMonth.length;
    
    // Low stock products
    const lowStockProducts = appData.saldo.filter(item => {
        const saldo = parseInt(item.Saldo);
        return saldo >= 0 && saldo <= 10;
    });
    
    const lowStockContainer = document.getElementById('baixo-estoque-container');
    
    if (lowStockProducts.length === 0) {
        lowStockContainer.innerHTML = '<p class="text-center text-muted">Não há produtos com estoque baixo.</p>';
    } else {
        let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Produto</th><th>Lote</th><th>Saldo</th></tr></thead><tbody>';
        
        lowStockProducts.forEach(product => {
            html += `<tr>
                <td>${product.Nome_Produto}</td>
                <td>${product.Número_do_Lote || product.Numero_do_Lote}</td>
                <td><span class="badge bg-warning">${product.Saldo}</span></td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        lowStockContainer.innerHTML = html;
    }
    
    // Products near expiry
    const nearExpiryProducts = appData.saldo.filter(item => {
        return item.Status === 'Próximo do vencimento' && parseInt(item.Saldo) > 0;
    });
    
    const vencimentoContainer = document.getElementById('vencimento-container');
    
    if (nearExpiryProducts.length === 0) {
        vencimentoContainer.innerHTML = '<p class="text-center text-muted">Não há produtos próximos do vencimento.</p>';
    } else {
        let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Produto</th><th>Lote</th><th>Validade</th></tr></thead><tbody>';
        
        nearExpiryProducts.forEach(product => {
            html += `<tr>
                <td>${product.Nome_Produto}</td>
                <td>${product.Número_do_Lote || product.Numero_do_Lote}</td>
                <td>${formatDate(product.Data_Validade)}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        vencimentoContainer.innerHTML = html;
    }
    
    // Save data to localStorage for offline use
    localStorage.setItem('appData', JSON.stringify(appData));
    localStorage.setItem('lastUpdate', new Date().toISOString());
}

// Products
function refreshProductsTable() {
    const productsTable = document.getElementById('products-table');
    const tbody = productsTable.querySelector('tbody');
    
    if (appData.produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum produto cadastrado</td></tr>';
        return;
    }
    
    // Join with balance data
    const productsWithBalance = appData.produtos.map(produto => {
        const balance = appData.saldo.find(item => item.ID_Produto === produto.ID_Produto) || {
            Saldo: 0,
            Status: 'N/A'
        };
        
        return {
            ...produto,
            Saldo: balance.Saldo,
            Status: balance.Status
        };
    });
    
    let html = '';
    
    productsWithBalance.forEach(produto => {
        const statusClass = getStatusClass(produto.Status);
        const statusBadge = getStatusBadge(produto.Status);
        
        html += `<tr>
            <td>${produto.Nome_Produto}</td>
            <td>${produto.Número_do_Lote || produto.Numero_do_Lote}</td>
            <td>${formatDate(produto.Data_Validade)}</td>
            <td>${statusBadge}</td>
            <td>${produto.Saldo}</td>
            <td>
                <div class="product-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="editProduct('${produto.ID_Produto}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${produto.ID_Produto}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function setupProductForm() {
    const addButton = document.getElementById('add-product-btn');
    const cancelButton = document.getElementById('cancel-product-btn');
    const form = document.getElementById('product-form');
    const formContainer = document.getElementById('product-form-container');
    
    addButton.addEventListener('click', () => {
        document.getElementById('product-form-title').textContent = 'Novo Produto';
        document.getElementById('product-id').value = '';
        form.reset();
        formContainer.style.display = 'block';
    });
    
    cancelButton.addEventListener('click', () => {
        formContainer.style.display = 'none';
    });
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const productId = document.getElementById('product-id').value;
        const productName = document.getElementById('product-name').value;
        const productLot = document.getElementById('product-lot').value;
        const productExpiry = document.getElementById('product-expiry').value;
        
        const productData = {
            Nome_Produto: productName,
            Numero_do_Lote: productLot,
            Data_Validade: productExpiry
        };
        
        if (productId) {
            // Edit existing product
            productData.ID_Produto = productId;
            updateProduct(productId, productData);
        } else {
            // Add new product
            addProduct(productData);
        }
    });
}

function addProduct(productData) {
    if (isOffline) {
        showToast('Não é possível adicionar produtos offline', 'text-danger');
        return;
    }
    
    showToast('Adicionando produto...', 'text-primary');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'create',
            sheet: 'Produtos',
            data: productData
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Produto adicionado com sucesso!', 'text-success');
            document.getElementById('product-form-container').style.display = 'none';
            loadAllData(); // Reload all data
        } else {
            throw new Error(data.message || 'Erro ao adicionar produto');
        }
    })
    .catch(error => {
        console.error('Error adding product:', error);
        showToast('Erro ao adicionar produto', 'text-danger');
    });
}

function editProduct(productId) {
    const product = appData.produtos.find(p => p.ID_Produto === productId);
    
    if (!product) {
        showToast('Produto não encontrado', 'text-danger');
        return;
    }
    
    document.getElementById('product-form-title').textContent = 'Editar Produto';
    document.getElementById('product-id').value = productId;
    document.getElementById('product-name').value = product.Nome_Produto;
    document.getElementById('product-lot').value = product.Número_do_Lote || product.Numero_do_Lote;
    
    // Format date for input
    const expiryDate = new Date(product.Data_Validade);
    const formattedDate = expiryDate.toISOString().split('T')[0];
    document.getElementById('product-expiry').value = formattedDate;
    
    document.getElementById('product-form-container').style.display = 'block';
}

function updateProduct(productId, productData) {
    if (isOffline) {
        showToast('Não é possível atualizar produtos offline', 'text-danger');
        return;
    }
    
    showToast('Atualizando produto...', 'text-primary');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'update',
            sheet: 'Produtos',
            id: productId,
            data: productData
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Produto atualizado com sucesso!', 'text-success');
            document.getElementById('product-form-container').style.display = 'none';
            loadAllData(); // Reload all data
        } else {
            throw new Error(data.message || 'Erro ao atualizar produto');
        }
    })
    .catch(error => {
        console.error('Error updating product:', error);
        showToast('Erro ao atualizar produto', 'text-danger');
    });
}

function deleteProduct(productId) {
    if (isOffline) {
        showToast('Não é possível excluir produtos offline', 'text-danger');
        return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
        return;
    }
    
    showToast('Excluindo produto...', 'text-primary');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'delete',
            sheet: 'Produtos',
            id: productId
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Produto excluído com sucesso!', 'text-success');
            loadAllData(); // Reload all data
        } else {
            throw new Error(data.message || 'Erro ao excluir produto');
        }
    })
    .catch(error => {
        console.error('Error deleting product:', error);
        showToast('Erro ao excluir produto', 'text-danger');
    });
}

// Entries
function refreshEntriesTable() {
    const entriesTable = document.getElementById('entries-table');
    const tbody = entriesTable.querySelector('tbody');
    
    if (appData.entradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma entrada cadastrada</td></tr>';
        return;
    }
    
    let html = '';
    
    // Sort entries by date (most recent first)
    const sortedEntries = [...appData.entradas].sort((a, b) => {
        return new Date(b.Data_Entrada) - new Date(a.Data_Entrada);
    });
    
    sortedEntries.forEach(entrada => {
        const produto = appData.produtos.find(p => p.ID_Produto === entrada.ID_Produto);
        const usuario = appData.usuarios.find(u => u.ID_Usuário === entrada.ID_Usuario || u.ID_Usuario === entrada.ID_Usuario);
        
        html += `<tr>
            <td>${produto ? produto.Nome_Produto : 'Produto não encontrado'}</td>
            <td>${entrada.Numero_NF || entrada.Número_NF}</td>
            <td>${formatDate(entrada.Data_Entrada)}</td>
            <td>${entrada.Quantidade}</td>
            <td>${usuario ? usuario.Nome_Usuário || usuario.Nome_Usuario : 'Usuário não encontrado'}</td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function setupEntryForm() {
    const addButton = document.getElementById('add-entry-btn');
    const cancelButton = document.getElementById('cancel-entry-btn');
    const form = document.getElementById('entry-form');
    const formContainer = document.getElementById('entry-form-container');
    
    addButton.addEventListener('click', () => {
        form.reset();
        document.getElementById('entry-date').value = getCurrentDate();
        formContainer.style.display = 'block';
    });
    
    cancelButton.addEventListener('click', () => {
        formContainer.style.display = 'none';
    });
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const entryData = {
            ID_Produto: document.getElementById('entry-product').value,
            Numero_NF: document.getElementById('entry-nf').value,
            Data_Entrada: document.getElementById('entry-date').value,
            Quantidade: document.getElementById('entry-quantity').value,
            ID_Usuario: document.getElementById('entry-user').value
        };
        
        addEntry(entryData);
    });
}

function addEntry(entryData) {
    if (isOffline) {
        showToast('Não é possível adicionar entradas offline', 'text-danger');
        return;
    }
    
    showToast('Adicionando entrada...', 'text-primary');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'create',
            sheet: 'Entrada de Produto',
            data: entryData
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Entrada adicionada com sucesso!', 'text-success');
            document.getElementById('entry-form-container').style.display = 'none';
            loadAllData(); // Reload all data
        } else {
            throw new Error(data.message || 'Erro ao adicionar entrada');
        }
    })
    .catch(error => {
        console.error('Error adding entry:', error);
        showToast('Erro ao adicionar entrada', 'text-danger');
    });
}

// Outputs
function refreshOutputsTable() {
    const outputsTable = document.getElementById('outputs-table');
    const tbody = outputsTable.querySelector('tbody');
    
    if (appData.saidas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma saída cadastrada</td></tr>';
        return;
    }
    
    let html = '';
    
    // Sort outputs by date (most recent first)
    const sortedOutputs = [...appData.saidas].sort((a, b) => {
        const dateA = new Date(a.Data_Saída || a.Data_Saida);
        const dateB = new Date(b.Data_Saída || b.Data_Saida);
        return dateB - dateA;
    });
    
    sortedOutputs.forEach(saida => {
        const produto = appData.produtos.find(p => p.ID_Produto === saida.ID_Produto);
        const local = appData.locais.find(l => l.ID_Local === saida.ID_Local_Destino);
        const responsavel = appData.usuarios.find(u => u.ID_Usuário === saida.ID_Responsavel || u.ID_Usuario === saida.ID_Responsavel);
        
        html += `<tr>
            <td>${produto ? produto.Nome_Produto : 'Produto não encontrado'}</td>
            <td>${local ? local.Nome_Local : 'Local não encontrado'}</td>
            <td>${formatDate(saida.Data_Saída || saida.Data_Saida)}</td>
            <td>${saida.Quantidade}</td>
            <td>${responsavel ? responsavel.Nome_Usuário || responsavel.Nome_Usuario : 'Responsável não encontrado'}</td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function setupOutputForm() {
    const addButton = document.getElementById('add-output-btn');
    const cancelButton = document.getElementById('cancel-output-btn');
    const form = document.getElementById('output-form');
    const formContainer = document.getElementById('output-form-container');
    
    addButton.addEventListener('click', () => {
        form.reset();
        document.getElementById('output-date').value = getCurrentDate();
        formContainer.style.display = 'block';
        
        // Auto-fill lot number based on selected product
        document.getElementById('output-product').addEventListener('change', function() {
            const productId = this.value;
            const product = appData.produtos.find(p => p.ID_Produto === productId);
            
            if (product) {
                document.getElementById('output-lot').value = product.Número_do_Lote || product.Numero_do_Lote || '';
            }
        });
    });
    
    cancelButton.addEventListener('click', () => {
        formContainer.style.display = 'none';
    });
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const outputData = {
            ID_Produto: document.getElementById('output-product').value,
            ID_Local_Destino: document.getElementById('output-place').value,
            Data_Saida: document.getElementById('output-date').value,
            Quantidade: document.getElementById('output-quantity').value,
            Numero_do_Lote: document.getElementById('output-lot').value,
            ID_Responsavel: document.getElementById('output-responsible').value
        };
        
        addOutput(outputData);
    });
}

function addOutput(outputData) {
    if (isOffline) {
        showToast('Não é possível adicionar saídas offline', 'text-danger');
        return;
    }
    
    // Check if there's enough stock
    const product = appData.saldo.find(p => p.ID_Produto === outputData.ID_Produto);
    
    if (product && parseInt(product.Saldo) < parseInt(outputData.Quantidade)) {
        showToast(`Saldo insuficiente. Disponível: ${product.Saldo}`, 'text-danger');
        return;
    }
    
    showToast('Adicionando saída...', 'text-primary');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'create',
            sheet: 'Saida Produtos',
            data: outputData
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Saída adicionada com sucesso!', 'text-success');
            document.getElementById('output-form-container').style.display = 'none';
            loadAllData(); // Reload all data
        } else {
            throw new Error(data.message || 'Erro ao adicionar saída');
        }
    })
    .catch(error => {
        console.error('Error adding output:', error);
        showToast('Erro ao adicionar saída', 'text-danger');
    });
}

// Balance
function refreshBalanceTable() {
    const balanceTable = document.getElementById('balance-table');
    const tbody = balanceTable.querySelector('tbody');
    
    if (appData.saldo.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum dado de saldo disponível</td></tr>';
        return;
    }
    
    let html = '';
    
    appData.saldo.forEach(item => {
        const statusClass = getStatusClass(item.Status);
        const statusBadge = getStatusBadge(item.Status);
        
        html += `<tr>
            <td>${item.Nome_Produto}</td>
            <td>${item.Número_do_Lote || item.Numero_do_Lote}</td>
            <td>${item.Total_Entradas}</td>
            <td>${item.Total_Saídas || item.Total_Saidas}</td>
            <td class="${parseInt(item.Saldo) <= 0 ? 'text-danger fw-bold' : ''}">${item.Saldo}</td>
            <td>${formatDate(item.Data_Validade)}</td>
            <td>${statusBadge}</td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

// Helper Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function getStatusClass(status) {
    if (!status) return '';
    
    switch(status) {
        case 'Vencido':
            return 'text-expired';
        case 'Próximo do vencimento':
            return 'text-warning';
        case 'Válido':
            return 'text-ok';
        default:
            return '';
    }
}

function getStatusBadge(status) {
    if (!status) return '';
    
    switch(status) {
        case 'Vencido':
            return '<span class="badge bg-danger">Vencido</span>';
        case 'Próximo do vencimento':
            return '<span class="badge bg-warning">Próximo do vencimento</span>';
        case 'Válido':
            return '<span class="badge bg-success">Válido</span>';
        default:
            return status;
    }
}

function showToast(message, colorClass) {
    toastMessage.textContent = message;
    toastMessage.className = 'toast-body ' + (colorClass || '');
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function updateOfflineStatus() {
    isOffline = !navigator.onLine;
    
    if (isOffline) {
        offlineBanner.style.display = 'block';
        document.getElementById('add-product-btn').disabled = true;
        document.getElementById('add-entry-btn').disabled = true;
        document.getElementById('add-output-btn').disabled = true;
    } else {
        offlineBanner.style.display = 'none';
        document.getElementById('add-product-btn').disabled = false;
        document.getElementById('add-entry-btn').disabled = false;
        document.getElementById('add-output-btn').disabled = false;
    }
}

// Populate Form Dropdowns
function populateProductDropdowns() {
    const productDropdowns = [
        document.getElementById('entry-product'),
        document.getElementById('output-product')
    ];
    
    productDropdowns.forEach(dropdown => {
        if (!dropdown) return;
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Selecione um produto</option>';
        
        // Add products
        appData.produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.ID_Produto;
            option.textContent = produto.Nome_Produto;
            dropdown.appendChild(option);
        });
    });
}

function populateLocationDropdowns() {
    const placeDropdown = document.getElementById('output-place');
    
    if (!placeDropdown) return;
    
    // Clear existing options except the first one
    placeDropdown.innerHTML = '<option value="">Selecione um local</option>';
    
    // Add locations
    appData.locais.forEach(local => {
        const option = document.createElement('option');
        option.value = local.ID_Local;
        option.textContent = local.Nome_Local;
        placeDropdown.appendChild(option);
    });
}

function populateUserDropdowns() {
    const userDropdowns = [
        document.getElementById('entry-user'),
        document.getElementById('output-responsible')
    ];
    
    userDropdowns.forEach(dropdown => {
        if (!dropdown) return;
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Selecione um usuário</option>';
        
        // Add users
        appData.usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.ID_Usuário || usuario.ID_Usuario;
            option.textContent = usuario.Nome_Usuário || usuario.Nome_Usuario;
            dropdown.appendChild(option);
        });
    });
}
