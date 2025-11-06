const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Buat folder uploads jika belum ada
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://*.vercel.app'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
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
  // Sort by date descending
  const sortedTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sortedTransactions);
});

// Add manual transaction
app.post('/api/transactions', (req, res) => {
  const transaction = {
    id: Date.now().toString(),
    type: req.body.type,
    amount: parseFloat(req.body.amount),
    description: req.body.description,
    category: req.body.category,
    date: req.body.date || new Date().toISOString().split('T')[0],
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
      receiptImage: req.file.filename,
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

// Import bank CSV
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
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  const initialLength = transactions.length;
  transactions = transactions.filter(t => t.id !== req.params.id);
  
  if (transactions.length < initialLength) {
    res.json({ success: true, message: 'Transaksi berhasil dihapus! 🗑️' });
  } else {
    res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
  }
});

// Get statistics
app.get('/api/statistics', (req, res) => {
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
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK ✅', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    transactions: transactions.length
  });
});

// ==================== UTILITY FUNCTIONS ====================

// Simulate OCR processing
async function simulateOCR(file) {
  console.log('Simulating OCR for:', file.originalname);
  
  // Delay untuk simulasi proses AI
  await new Promise(resolve => setTimeout(resolve, 1500));
  
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
    },
    {
      type: 'pengeluaran',
      amount: 50000,
      description: 'Bensin SPBU',
      category: 'transportasi',
      date: new Date().toISOString().split('T')[0]
    },
    {
      type: 'pemasukan',
      amount: 1000000,
      description: 'Freelance Project',
      category: 'freelance',
      date: new Date().toISOString().split('T')[0]
    }
  ];

  const randomData = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  console.log('Extracted data:', randomData);
  
  return randomData;
}

// Process bank CSV files
async function processBankCSV(csvData, bankName) {
  console.log(`Processing ${bankName} CSV data`);
  
  const parsers = {
    'bca': parseBCACSV,
    'mandiri': parseMandiriCSV,
    'bni': parseBNICSV,
    'bri': parseBRICSV
  };

  const parser = parsers[bankName] || parseGenericCSV;
  return parser(csvData, bankName);
}

function parseBCACSV(csvData, bankName) {
  const transactions = [];
  const lines = csvData.split('\n');
  
  // BCA format: Tanggal, Keterangan, Cabang, Jumlah, Type, Saldo
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length >= 6) {
      const amount = parseFloat(cells[3].replace(/[^\d.-]/g, ''));
      const type = cells[4].includes('C') ? 'pemasukan' : 'pengeluaran';
      const description = cells[1].replace(/"/g, '').trim();
      
      if (!isNaN(amount) && amount !== 0) {
        transactions.push({
          type: type,
          amount: Math.abs(amount),
          description: description || 'Transaksi BCA',
          category: autoCategorize(description, amount, type),
          date: parseDate(cells[0]) || new Date().toISOString().split('T')[0],
          bank: bankName
        });
      }
    }
  }
  
  return transactions;
}

function parseMandiriCSV(csvData, bankName) {
  const transactions = [];
  const lines = csvData.split('\n');
  
  // Mandiri format biasanya pakai ;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';');
    if (cells.length >= 5) {
      const amount = parseFloat(cells[4].replace(/[^\d.-]/g, ''));
      const description = cells[2]?.trim() || 'Transaksi Mandiri';
      const type = amount >= 0 ? 'pemasukan' : 'pengeluaran';
      
      if (!isNaN(amount) && amount !== 0) {
        transactions.push({
          type: type,
          amount: Math.abs(amount),
          description: description,
          category: autoCategorize(description, amount, type),
          date: parseDate(cells[0]) || new Date().toISOString().split('T')[0],
          bank: bankName
        });
      }
    }
  }
  
  return transactions;
}

function parseBNICSV(csvData, bankName) {
  return parseGenericCSV(csvData, bankName);
}

function parseBRICSV(csvData, bankName) {
  return parseGenericCSV(csvData, bankName);
}

function parseGenericCSV(csvData, bankName) {
  const transactions = [];
  const lines = csvData.split('\n');
  
  // Try different delimiters
  const delimiters = [',', ';', '\t'];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    let cells = [];
    for (const delimiter of delimiters) {
      cells = lines[i].split(delimiter);
      if (cells.length >= 3) break;
    }
    
    // Look for amount pattern
    const amountMatch = lines[i].match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
      const description = cells[1]?.trim() || `Transaksi ${bankName.toUpperCase()}`;
      const type = amount >= 0 ? 'pemasukan' : 'pengeluaran';
      
      if (!isNaN(amount) && amount !== 0) {
        transactions.push({
          type: type,
          amount: Math.abs(amount),
          description: description,
          category: autoCategorize(description, amount, type),
          date: new Date().toISOString().split('T')[0],
          bank: bankName
        });
      }
    }
  }
  
  return transactions;
}

function autoCategorize(description, amount, type) {
  const desc = description.toLowerCase();
  
  const categories = {
    'gaji': ['gaji', 'salary', 'payroll'],
    'investasi': ['saham', 'reksadana', 'investasi', 'dividen'],
    'freelance': ['freelance', 'project', 'client', 'kontrak'],
    'makanan': ['restoran', 'makan', 'warung', 'kafe', 'food', 'minum'],
    'transportasi': ['bensin', 'spbu', 'transport', 'gojek', 'grab', 'taxi'],
    'belanja': ['supermarket', 'mall', 'belanja', 'market', 'alfamart', 'indomaret'],
    'hiburan': ['netflix', 'spotify', 'youtube', 'game', 'hiburan', 'movie'],
    'kesehatan': ['rumah sakit', 'klinik', 'dokter', 'obat', 'apotek'],
    'utilitas': ['listrik', 'pln', 'pdam', 'air', 'internet', 'wifi']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category;
      }
    }
  }
  
  return type === 'pemasukan' ? 'pendapatan' : 'lainnya';
}

function parseDate(dateString) {
  try {
    // Handle various date formats
    const formats = [
      /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, // DD/MM/YYYY
      /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/, // YYYY/MM/DD
    ];
    
    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        if (match[3] && match[3].length === 4) {
          // DD/MM/YYYY
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else {
          // YYYY-MM-DD
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
      }
    }
    
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    return new Date().toISOString().split('T')[0];
  }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Finance Tracker Backend running!`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌍 Health: http://localhost:${PORT}/health`);
  console.log(`📊 API Ready: http://localhost:${PORT}/api/transactions`);
});
