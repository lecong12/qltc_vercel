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

    // Xử lý Private Key:
    // 1. Thay thế \\n thành \n (nếu copy từ JSON)
    // 2. Nếu key bị bao quanh bởi dấu ngoặc kép (do copy thừa), hãy loại bỏ chúng
    let privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
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
      id: row[0],        // Cột A: ID
      date: row[1],      // Cột B: Ngày
      type: row[2],      // Cột C: Loại
      category: row[3],  // Cột D: Hạng mục
      amount: parseFloat((row[4] || '0').replace(/,/g, '')), // Cột E: Số tiền
      note: row[5] || '', // Cột F: Ghi chú (Thêm || '' để tránh lỗi undefined)
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