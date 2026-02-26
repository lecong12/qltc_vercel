const { google } = require('googleapis');
const express = require('express');
const app = express();

app.use(express.json());

// Helper: Khởi tạo Google Sheets Client
function getSheetsClient() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing required environment variables.');
  }

  let privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// API Lấy toàn bộ giao dịch tài chính
app.get('/api/qltc/transactions', async (req, res) => {
  try {
    // --- Robustness Check: Verify environment variables ---
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID } = process.env;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
      console.error('Missing required environment variables on Vercel.');
      return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }

    const sheets = getSheetsClient();

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
      amount: parseFloat((row[4] || '0').replace(/\./g, '').replace(',', '.')), // Cột E: Số tiền (Hỗ trợ định dạng VN: 2.500.000)
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

// API Thêm giao dịch mới
app.post('/api/qltc/add', async (req, res) => {
  try {
    const { date, type, category, amount, note } = req.body;
    const sheets = getSheetsClient();
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const id = Date.now().toString(); // Tạo ID duy nhất dựa trên thời gian

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!A2',
      valueInputOption: 'USER_ENTERED',
      resource: {
        // Thứ tự cột: ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú
        values: [[id, date, type, category, amount, note]]
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Add Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Xóa giao dịch
app.post('/api/qltc/delete', async (req, res) => {
  try {
    const { id } = req.body;
    const sheets = getSheetsClient();
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    // 1. Tìm sheetId của sheet 'Data'
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = meta.data.sheets.find(s => s.properties.title === 'Data');
    if (!sheet) throw new Error('Sheet "Data" not found');
    const sheetId = sheet.properties.sheetId;

    // 2. Tìm dòng chứa ID cần xóa
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!A:A', // Chỉ đọc cột ID
    });
    const rows = data.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id.toString());

    if (rowIndex === -1) return res.status(404).json({ success: false, message: 'Transaction not found' });

    // 3. Xóa dòng đó
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
          }
        }]
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Cập nhật giao dịch
app.post('/api/qltc/update', async (req, res) => {
  try {
    const { id, date, type, category, amount, note } = req.body;
    const sheets = getSheetsClient();
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    // 1. Tìm sheetId và vị trí dòng
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!A:A', // Chỉ đọc cột ID để tìm kiếm
    });
    const rows = data.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id.toString());

    if (rowIndex === -1) return res.status(404).json({ success: false, message: 'Transaction not found' });

    // 2. Cập nhật dòng đó (rowIndex + 1 vì Google Sheets bắt đầu từ dòng 1)
    // Cập nhật từ cột A đến F (ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú)
    const range = `Data!A${rowIndex + 1}:F${rowIndex + 1}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[id, date, type, category, amount, note]]
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Đăng nhập
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const sheets = getSheetsClient();
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:C', // Cột A: User, B: Pass, C: Tên hiển thị
    });

    const users = response.data.values || [];
    const user = users.find(u => u[0] === username && u[1] === password);

    if (user) {
      res.json({ success: true, userData: { username: user[0], name: user[2] } });
    } else {
      res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;