async function loadFinancialData() {
    try {
        const res = await fetch('/api/qltc/transactions');
        const result = await res.json();
        
        if (result.success) {
            const data = result.data;
            
            // 1. Cập nhật bảng danh sách giao dịch
            renderTransactionTable(data);
            
            // 2. Tính toán tổng số dư (Balance) cho QLTC
            calculateSummary(data);
            
            // 3. Nếu bạn có dùng biểu đồ (ví dụ Chart.js)
            if (typeof updateCharts === "function") {
                updateCharts(data);
            }
        } else {
            // Hiển thị lỗi từ Server trả về (ví dụ: sai tên sheet, chưa share quyền)
            console.error("Lỗi từ server:", result.message);
            const loadingEl = document.querySelector('.loading');
            if (loadingEl) loadingEl.innerText = '⚠️ Lỗi: ' + result.message;
        }
    } catch (err) {
        console.error("Lỗi tải dữ liệu tài chính:", err);
        const loadingEl = document.querySelector('.loading');
        if (loadingEl) loadingEl.innerText = '⚠️ Lỗi kết nối: ' + err.message;
    }
}

function calculateSummary(data) {
    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach(item => {
        if (item.type && (item.type.trim().toLowerCase() === 'thu' || item.type.trim().toLowerCase() === 'income')) {
            totalIncome += item.amount;
        } else {
            totalExpense += item.amount;
        }
    });

    // Cập nhật lên giao diện (đảm bảo bạn có các ID này trong HTML)
    if(document.getElementById('totalIncome')) 
        document.getElementById('totalIncome').innerText = totalIncome.toLocaleString() + 'đ';
    if(document.getElementById('totalExpense')) 
        document.getElementById('totalExpense').innerText = totalExpense.toLocaleString() + 'đ';
    if(document.getElementById('balance')) 
        document.getElementById('balance').innerText = (totalIncome - totalExpense).toLocaleString() + 'đ';
}

// 4. Hàm hiển thị dữ liệu lên bảng HTML (Bổ sung)
function renderTransactionTable(data) {
    // Lưu ý: Trong file index.html của bạn cần có thẻ <tbody> với id="transactionTableBody"
    // Ví dụ: <table><tbody id="transactionTableBody"></tbody></table>
    const tbody = document.getElementById('transactionTableBody') || document.querySelector('tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = ''; // Xóa dữ liệu cũ
    data.forEach(item => {
        const row = `<tr>
            <td>${item.date}</td>
            <td>${item.type}</td>
            <td>${item.category}</td>
            <td>${item.amount.toLocaleString()}</td>
            <td style="text-align: center; cursor: pointer;">✏️ 🗑</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// 5. Tự động chạy hàm này khi trang web tải xong
document.addEventListener('DOMContentLoaded', loadFinancialData);