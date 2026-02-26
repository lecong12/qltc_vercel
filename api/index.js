const { google } = require('googleapis');
const express = require('express');
const app = express();

app.use(express.json());

// API Lấy toàn bộ giao dịch tài chính
app.get('/api/qltc/transactions', async (req, res) => {
  try {
    // --- Robustness Check: Verify environment variables ---
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID } = process.env;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
      console.error('Missing required environment variables on Vercel.');
      return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Giả sử dữ liệu nằm ở sheet 'GiaoDich' từ cột A đến G
    // (Ngày, Loại, Danh mục, Tài khoản, Số tiền, Ghi chú, Người tạo)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!A2:G', 
    });
    
    // Xử lý dữ liệu thô thành JSON object để Frontend dễ đọc
    const rows = response.data.values || [];
    const transactions = rows
      .filter(row => row.length > 0 && row[0]) // Bỏ qua các hàng trống để tránh lỗi
      .map(row => ({
      date: row[0],
      type: row[1],      // Thu hoặc Chi
      category: row[2],
      account: row[3],
      amount: parseFloat((row[4] || '0').replace(/,/g, '')),
      note: row[5],
      id: row[6]         // ID duy nhất của giao dịch
    }));

    res.json({ success: true, data: transactions });
  } catch (error) {
    // Log lỗi chi tiết ở phía server để debug (xem trên Vercel Logs)
    console.error('API Error fetching transactions:', error);
    // Chỉ gửi một thông báo lỗi chung cho client
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = app;