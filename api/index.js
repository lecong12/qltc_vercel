const { google } = require('googleapis');
const express = require('express');
const app = express();

app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// API Lấy toàn bộ giao dịch tài chính
app.get('/api/qltc/transactions', async (req, res) => {
  try {
    // Giả sử dữ liệu nằm ở sheet 'GiaoDich' từ cột A đến G
    // (Ngày, Loại, Danh mục, Tài khoản, Số tiền, Ghi chú, Người tạo)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'GiaoDich!A2:G', 
    });
    
    // Xử lý dữ liệu thô thành JSON object để Frontend dễ đọc
    const rows = response.data.values || [];
    const transactions = rows.map(row => ({
      date: row[0],
      type: row[1],      // Thu hoặc Chi
      category: row[2],
      account: row[3],
      amount: parseFloat(row[4].replace(/,/g, '') || 0),
      note: row[5],
      id: row[6]         // ID duy nhất của giao dịch
    }));

    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;