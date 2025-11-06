const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test data
let transactions = [
  {
    id: '1',
    type: 'pemasukan',
    amount: 5000000,
    description: 'Gaji Bulan Januari',
    category: 'gaji',
    date: '2024-01-15'
  }
];

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Finance Tracker API is running! 🚀',
    status: 'OK'
  });
});

app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

app.post('/api/transactions', (req, res) => {
  const { type, amount, description, category, date } = req.body;
  
  const newTransaction = {
    id: Date.now().toString(),
    type,
    amount: parseFloat(amount),
    description,
    category,
    date: date || new Date().toISOString().split('T')[0]
  };
  
  transactions.push(newTransaction);
  res.json({ success: true, transaction: newTransaction });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK ✅', 
    timestamp: new Date().toISOString(),
    transactions: transactions.length 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
