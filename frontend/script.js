// Configuration
const getApiBase = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    } else {
        // Ganti dengan URL backend Railway setelah deploy
        return 'https://your-backend.railway.app/api';
    }
};

const API_BASE = getApiBase();
let transactions = [];
let currentExtractedData = null;
let currentBankImportData = null;
let selectedBank = 'bca';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Set default month filter to current month
    const now = new Date();
    document.getElementById('filterMonth').value = now.toISOString().slice(0, 7);
    
    setupEventListeners();
    loadTransactions();
}

function setupEventListeners() {
    // Manual form
    document.getElementById('manualForm').addEventListener('submit', addManualTransaction);
    
    // Receipt upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('receipt');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleReceiptUpload);
    
    // Bank CSV upload
    const bankUploadArea = document.getElementById('bankUploadArea');
    const bankCsvInput = document.getElementById('bankCsv');
    
    bankUploadArea.addEventListener('click', () => bankCsvInput.click());
    bankCsvInput.addEventListener('change', handleBankCsvUpload);
    
    // Bank selection
    document.querySelectorAll('.bank-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.bank-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedBank = this.dataset.bank;
        });
    });
    
    // Confirm buttons
    document.getElementById('confirmData').addEventListener('click', confirmExtractedData);
    document.getElementById('confirmImport').addEventListener('click', confirmBankImport);
}

// Tab navigation
function openTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
    
    // Reset forms when switching tabs
    if (tabName === 'upload') {
        resetReceiptUpload();
    } else if (tabName === 'bank') {
        resetBankImport();
    }
}

// Load transactions from API
async function loadTransactions() {
    try {
        showLoading('transactionsList');
        const response = await fetch(`${API_BASE}/transactions`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        transactions = await response.json();
        displayTransactions();
        updateStatistics();
        updateCategoryFilter();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showNotification('Gagal memuat transaksi', 'error');
    }
}

// Display transactions
function displayTransactions(filteredTransactions = null) {
    const transactionsList = document.getElementById('transactionsList');
    const dataToDisplay = filteredTransactions || transactions;
    
    if (dataToDisplay.length === 0) {
        transactionsList.innerHTML = '<div class="loading">📝 Tidak ada transaksi</div>';
        return;
    }
    
    transactionsList.innerHTML = dataToDisplay.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <strong>${transaction.description}</strong>
                <div class="transaction-meta">
                    <span>📅 ${formatDate(transaction.date)}</span>
                    <span>•</span>
                    <span>🏷️ ${transaction.category}</span>
                    ${transaction.receiptImage ? '<span>•</span><span>📷 Resi</span>' : ''}
                    ${transaction.bank ? '<span>•</span><span>🏦 ' + transaction.bank.toUpperCase() + '</span>' : ''}
                </div>
            </div>
            <div class="transaction-amount ${transaction.type === 'pemasukan' ? 'transaction-income' : 'transaction-expense'}">
                ${transaction.type === 'pemasukan' ? '+' : '-'} Rp ${transaction.amount.toLocaleString('id-ID')}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${transaction.id}')" title="Hapus transaksi">
                🗑️
            </button>
        </div>
    `).join('');
}

// Filter transactions
function filterTransactions() {
    const typeFilter = document.getElementById('filterType').value;
    const categoryFilter = document.getElementById('filterCategory').value;
    const monthFilter = document.getElementById('filterMonth').value;
    
    let filtered = transactions;
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter);
    }
    
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    if (monthFilter) {
        filtered = filtered.filter(t => t.date.startsWith(monthFilter));
    }
    
    displayTransactions(filtered);
}

// Update category filter options
function updateCategoryFilter() {
    const categoryFilter = document.getElementById('filterCategory');
    const categories = [...new Set(transactions.map(t => t.category))];
    
    categoryFilter.innerHTML = '<option value="all">Semua Kategori</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

// Add manual transaction
async function addManualTransaction(event) {
    event.preventDefault();
    
    const formData = {
        type: document.getElementById('type').value,
        amount: parseFloat(document.getElementById('amount').value),
        description: document.getElementById('description').value.trim(),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value
    };
    
    // Validation
    if (formData.amount <= 0) {
        showNotification('Jumlah harus lebih dari 0', 'error');
        return;
    }
    
    if (!formData.description) {
        showNotification('Keterangan tidak boleh kosong', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('manualForm').reset();
            document.getElementById('date').valueAsDate = new Date();
            loadTransactions();
            showNotification(result.message || 'Transaksi berhasil ditambahkan!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
        showNotification(error.message || 'Gagal menambahkan transaksi', 'error');
    }
}

// Handle receipt upload
async function handleReceiptUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
        showNotification('Hanya file gambar yang diizinkan!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Ukuran file maksimal 5MB!', 'error');
        return;
    }
    
    // Show preview
    const preview = document.getElementById('preview');
    const uploadArea = document.getElementById('uploadArea');
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    
    placeholder.style.display = 'none';
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    
    // Show upload status
    const statusElement = document.getElementById('uploadStatus');
    statusElement.innerHTML = '<div class="loading">🔄 Memproses gambar...</div>';
    statusElement.style.display = 'block';
    
    // Upload to server
    const formData = new FormData();
    formData.append('receipt', file);
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusElement.style.display = 'none';
            currentExtractedData = result.extractedData;
            displayExtractedData(result.extractedData);
            showNotification(result.message || 'Gambar berhasil diproses!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        statusElement.innerHTML = `<div style="color: #e74c3c; text-align: center;">❌ ${error.message || 'Gagal memproses gambar'}</div>`;
        showNotification('Gagal memproses gambar', 'error');
        resetReceiptUpload();
    }
}

// Display extracted data from receipt
function displayExtractedData(data) {
    document.getElementById('detectedType').textContent = data.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
    document.getElementById('detectedAmount').textContent = `Rp ${data.amount.toLocaleString('id-ID')}`;
    document.getElementById('detectedDescription').textContent = data.description;
    document.getElementById('detectedCategory').textContent = data.category;
    
    document.getElementById('extractedData').style.display = 'block';
}

// Confirm extracted data
async function confirmExtractedData() {
    if (!currentExtractedData) {
        showNotification('Tidak ada data untuk disimpan', 'error');
        return;
    }
    
    const transactionData = {
        type: currentExtractedData.type,
        amount: currentExtractedData.amount,
        description: currentExtractedData.description,
        category: currentExtractedData.category,
        date: currentExtractedData.date
    };
    
    try {
        const response = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message || 'Transaksi berhasil disimpan!', 'success');
            resetReceiptUpload();
            loadTransactions();
            currentExtractedData = null;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
        showNotification(error.message || 'Gagal menyimpan transaksi', 'error');
    }
}

// Handle bank CSV upload
async function handleBankCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showNotification('Hanya file CSV yang diizinkan!', 'error');
        return;
    }
    
    // Show upload status
    const bankUploadArea = document.getElementById('bankUploadArea');
    const placeholder = bankUploadArea.querySelector('.upload-placeholder');
    placeholder.innerHTML = '<div class="loading">🔄 Memproses file CSV...</div>';
    
    // Upload to server
    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('bankName', selectedBank);
    
    try {
        const response = await fetch(`${API_BASE}/bank/import`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentBankImportData = result.transactions;
            displayBankImportResults(result);
            showNotification(result.message || 'File berhasil diproses!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error uploading CSV:', error);
        placeholder.innerHTML = `
            <span>📊</span>
            <p>Upload file CSV dari internet banking</p>
            <small style="color: #e74c3c;">❌ ${error.message || 'Gagal memproses file'}</small>
        `;
        showNotification('Gagal memproses file CSV', 'error');
    }
}

// Display bank import results
function displayBankImportResults(result) {
    document.getElementById('importCount').textContent = result.transactions.length;
    document.getElementById('importIncome').textContent = `Rp ${result.summary.income.toLocaleString('id-ID')}`;
    document.getElementById('importExpense').textContent = `Rp ${result.summary.expense.toLocaleString('id-ID')}`;
    
    document.getElementById('bankImportResults').style.display = 'block';
    
    // Reset upload area
    const bankUploadArea = document.getElementById('bankUploadArea');
    const placeholder = bankUploadArea.querySelector('.upload-placeholder');
    placeholder.innerHTML = `
        <span>📊</span>
        <p>Upload file CSV dari internet banking</p>
        <small>Download laporan transaksi format CSV</small>
    `;
}

// Confirm bank import
async function confirmBankImport() {
    if (!currentBankImportData || currentBankImportData.length === 0) {
        showNotification('Tidak ada data untuk disimpan', 'error');
        return;
    }
    
    try {
        // Save all transactions
        for (const transaction of currentBankImportData) {
            await fetch(`${API_BASE}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });
        }
        
        showNotification(`${currentBankImportData.length} transaksi berhasil disimpan!`, 'success');
        resetBankImport();
        loadTransactions();
        currentBankImportData = null;
    } catch (error) {
        console.error('Error saving bank transactions:', error);
        showNotification('Gagal menyimpan transaksi', 'error');
    }
}

// Delete transaction
async function deleteTransaction(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadTransactions();
            showNotification(result.message || 'Transaksi berhasil dihapus!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showNotification(error.message || 'Gagal menghapus transaksi', 'error');
    }
}

// Update statistics
async function updateStatistics() {
    try {
        const response = await fetch(`${API_BASE}/statistics`);
        const stats = await response.json();
        
        document.getElementById('balance').textContent = `Rp ${stats.balance.toLocaleString('id-ID')}`;
        document.getElementById('totalIncome').textContent = `Rp ${stats.totalIncome.toLocaleString('id-ID')}`;
        document.getElementById('totalExpense').textContent = `Rp ${stats.totalExpense.toLocaleString('id-ID')}`;
        
        // Update balance color
        const balanceElement = document.getElementById('balance');
        balanceElement.className = stats.balance >= 0 ? 'amount income' : 'amount expense';
