const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Fix untuk Render - gunakan path absolute
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware - simplified CORS untuk production
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - fix path untuk production
app.use('/uploads', express.static(uploadsDir));

// Konfigurasi upload file - fix untuk production
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    // Sanitize filename
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, Date.now() + '-' + originalName)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Simpan data transaksi (sementara di memory)
let transactions = [
  {
    id: '1',
    type: 'pemasukan',
    amount: 5000000,
    description: 'Gaji Bulan Januari',
    category: 'gaji',
    date: '2024-01-15',
    receiptImage: null,
    bank: null,
    createdAt: new Date().toISOString()
  },
  {
    id: '2', 
    type: 'pengeluaran',
    amount: 150000,
    description: 'Belanja Bulanan',
    category: 'belanja',
    date: '2024-01-16',
    receiptImage: null,
    bank: null,
    createdAt: new Date().toISOString()
  }
];

// ==================== ROUTES ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Finance Tracker API is running! 🚀',
    version: '1.0.0',
    endpoints: {
      transactions: '/api/transactions',
      upload: '/api/upload',
      bank: '/api/bank/import',
      statistics: '/api/statistics'
    }
  });
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    // Sort by date descending
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sortedTransactions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add manual transaction
app.post('/api/transactions', (req, res) => {
  try {
    const { type, amount, description, category, date } = req.body;
    
    // Validation
    if (!type || !amount || !category) {
      return res.status(400).json({ error: 'Type, amount, dan category harus diisi' });
    }

    const transaction = {
      id: Date.now().toString(),
      type: type,
      amount: parseFloat(amount),
      description: description || '',
      category: category,
      date: date || new Date().toISOString().split('T')[0],
      receiptImage: null,
      bank: null,
      createdAt: new Date().toISOString()
    };

    transactions.push(transaction);
    
    res.json({ 
      success: true, 
      transaction,
      message: 'Transaksi berhasil ditambahkan! ✅'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload receipt and process with OCR
app.post('/api/upload', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    console.log('File received:', req.file.originalname);

    // Simulasi proses OCR
    const extractedData = await simulateOCR(req.file);
    
    const transaction = {
      id: Date.now().toString(),
      ...extractedData,
      receiptImage: `/uploads/${req.file.filename}`,
      bank: null,
      createdAt: new Date().toISOString()
    };

    transactions.push(transaction);

    res.json({
      success: true,
      message: 'Gambar berhasil diproses! 📷',
      transaction: transaction,
      extractedData: extractedData
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses gambar' });
  }
});

// Import bank CSV - simplified untuk production
app.post('/api/bank/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    const bankName = req.body.bankName || 'bca';
    
    // Process CSV file
    const csvData = fs.readFileSync(req.file.path, 'utf8');
    const transactionsData = await processBankCSV(csvData, bankName);
    
    // Delete temporary file
    fs.unlinkSync(req.file.path);

    // Add to main transactions
    transactionsData.forEach(transaction => {
      transactions.push({
        id: Date.now().toString() + Math.random(),
        ...transaction,
        createdAt: new Date().toISOString()
      });
    });

    // Calculate summary
    const summary = {
      total: transactionsData.length,
      income: transactionsData.filter(t => t.type === 'pemasukan').reduce((sum, t) => sum + t.amount, 0),
      expense: transactionsData.filter(t => t.type === 'pengeluaran').reduce((sum, t) => sum + t.amount, 0)
    };

    res.json({
      success: true,
      message: `Berhasil memproses ${transactionsData.length} transaksi dari ${bankName.toUpperCase()}!`,
      transactions: transactionsData,
      summary: summary
    });

  } catch (error) {
    console.error('Error processing bank CSV:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses file CSV' });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const initialLength = transactions.length;
    transactions = transactions.filter(t => t.id !== req.params.id);
    
    if (transactions.length < initialLength) {
      res.json({ success: true, message: 'Transaksi berhasil dihapus! 🗑️' });
    } else {
      res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get statistics
app.get('/api/statistics', (req, res) => {
  try {
    const totalIncome = transactions
      .filter(t => t.type === 'pemasukan')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'pengeluaran')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpense,
      balance,
      transactionCount: transactions.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check untuk Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK ✅', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    transactions: transactions.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== UTILITY FUNCTIONS ====================

// Simulate OCR processing
async function simulateOCR(file) {
  console.log('Simulating OCR for:', file.originalname);
  
  // Delay untuk simulasi proses AI
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockResponses = [
    {
      type: 'pengeluaran',
      amount: 150000,
      description: 'Belanja di Supermarket',
      category: 'belanja',
      date: new Date().toISOString().split('T')[0]
    },
    {
      type: 'pengeluaran',
      amount: 75000,
      description: 'Makan siang di Restoran',
      category: 'makanan',
      date: new Date().toISOString().split('T')[0]
    }
  ];

  const randomData = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  return randomData;
}

// Process bank CSV files - simplified
async function processBankCSV(csvData, bankName) {
  console.log(`Processing ${bankName} CSV data`);
  
  // Simple CSV parser untuk production
  const transactions = [];
  const lines = csvData.split('\n').slice(1); // Skip header
  
  for (let i = 0; i < Math.min(lines.length, 10); i++) { // Max 10 transactions untuk demo
    if (!lines[i].trim()) continue;
    
    const cells = lines[i].split(',');
    if (cells.length >= 2) {
      const amount = parseFloat(cells[1]) || 100000;
      const description = cells[0]?.trim() || `Transaksi ${bankName}`;
      
      transactions.push({
        type: amount > 0 ? 'pemasukan' : 'pengeluaran',
        amount: Math.abs(amount),
        description: description,
        category: 'lainnya',
        date: new Date().toISOString().split('T')[0],
        bank: bankName
      });
    }
  }
  
  return transactions;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server - FIX untuk production
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Finance Tracker Backend running on port ${PORT}!`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Uploads directory: ${uploadsDir}`);
});
