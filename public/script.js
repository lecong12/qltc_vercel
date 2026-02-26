let allTransactions = [];
let editingTransactionId = null;

async function loadFinancialData() {
    try {
        const res = await fetch('/api/qltc/transactions');
        const result = await res.json();
        
        if (result.success) {
            s plyFilters(); // Áp dụng bộ lọc và hiển thị dữ liệu
            ịer trả về (ví dụ: sai tên sheet, chưa share quyền)
            console.error("Lỗi từ server:", result.message);
            const loadingEl = document.querySelector('.loading');
            if (loadingEl) loadingEl.innerText = '⚠️ Lỗi: ' + result.message;
        }
        console.error("Lỗi tải dữ liệu tài chính:", err);
        const loadingEl = document.querySelector('.loading');
        if (loadingEl) loadingEl.innerText = '⚠️ Lỗi kết nối: ' + err.message;
    }
}

function applyFilters() {
    const typeFilter = document.getElementById('filterType').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    const filteredData = allTransactions.filter(item => {
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        const content = (item.category || '') + ' ' + (item.note || '');
        const matchesSearch = content.toLowerCase().includes(searchText);
        return matchesType && matchesSearch;
    });

    renderTransactionTable(filteredData);
    calculateSummary(filteredData);
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
        document.getElementById('totalIncome').innerText = totalIncome.toLocaleString('de-DE') + 'đ';
    if(document.getElementById('totalExpense'))
        document.getElementById('totalExpense').innerText = totalExpense.toLocaleString('de-DE') + 'đ';
    if(document.getElementById('balance'))
        document.getElementById('balance').innerText = (totalIncome - totalExpense).toLocaleString('de-DE') + 'đ';
}

// 4. Hàm hiển thị dữ liệu lên bảng HTML (Bổ sung)
function renderTransactionTable(data) {
    // Lưu ý: Trong file index.html của bạn cần có thẻ <tbody> với id="transactionTableBody"
    // Ví dụ: <table><tbody id="transactionTableBody"></tbody></table>
    const tbody = document.getElementById('transactionTableBody') || document.querySelector('tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = ''; // Xóa dữ liệu cũ
    data.forEach(item => {
        const isIncome = item.type && (item.type.trim().toLowerCase() === 'thu' || item.type.trim().toLowerCase() === 'income');
        const rowClass = isIncome ? 'income-row' : 'expense-row';

        const row = `<tr class="${rowClass}">
            <td>${item.date}</td>
            <td>${item.type}</td>
            <td>${item.category}</td>
            <td>${item.amount.toLocaleString('de-DE')}</td>
            <td class="actions-cell" style="text-align: center;">
                <button onclick="editTransaction('${item.id}')" style="border:none; background:none; cursor:pointer; margin-right: 5px;">✏️</button>
                <button onclick="deleteTransaction('${item.id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// --- CÁC HÀM MỚI BỔ SUNG ---

// 6. Hiển thị Modal
function showModal() {
    document.getElementById('transactionModal').style.display = 'block';
    // Chỉ đặt ngày mặc định nếu đang thêm mới
    if (!editingTransactionId) {
        document.getElementById('tDate').valueAsDate = new Date();
    }
}

// 7. Đóng Modal
function closeModal() {
    editingTransactionId = null;
    document.getElementById('modalTitle').innerText = 'Thêm Giao Dịch Mới';
}

// 8. Xử lý Submit Form (Thêm mới)
async function handleFormSubmit(event) {
    event.preventDefault();
    const btn = document.querySelector('.btn-save');
    btn.innerText = 'Đang lưu...';
    btn.disabled = true;

    const data = {
        date: document.getElementById('tDate').value.split('-').reverse().join('/'), // Chuyển yyyy-mm-dd thành dd/mm/yyyy
        type: document.getElementById('tType').value,
        category: document.getElementById('tCategory').value,
        amount: document.getElementById('tAmount').value,
        note: document.getElementById('tNote').value
    };

    // Nếu đang sửa, thêm ID vào data và đổi URL
    if (editingTransactionId) {
        data.id = editingTransactionId;
    }

    const url = editingTransactionId ? '/api/qltc/update' : '/api/qltc/add';

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            closeModal();
            loadFinancialData(); // Tải lại bảng
        } else {
            alert('Lỗi: ' + resu
    } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
    } finally {
        btn.innerText = 'Lưu Giao Dịch';
        btn.disabled = false;
    }
}

// 9. Xóa giao dịch
async function deleteTransaction(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    
    try {
        const res = await fetch('/api/qltc/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await res.json();
        if (result.success) {
            loadFinancialData();
        } else {
            alert('Lỗi xóa: ' + result.message);
        }
    } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
    }
}

// 10. Sửa giao dịch
function editTransaction(id) {
    const transaction = allTransactions.find(t => t.id === id);
    if (!transaction) return;

    editingTransactionId = id;
    
    // Chuyển đổi ngày từ dd/mm/yyyy sang yyyy-mm-dd cho input date
    const parts = transaction.date.split('/');
    if (parts.length === 3) {
        document.getElementById('tDate').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    document.getElementById('tType').value = transaction.type;
    document.getElementById('tCategory').value = transaction.category;
    document.getElementById('tAmount').value = transaction.amount;
    document.getElementById('tNote').value = transaction.note;

    document.getElementById('modalTitle').innerText = 'Sửa Giao Dịch';
    showModal();
}

// Đóng modal khi click ra ngoài
window.onclick = function(event) {
    const modal = document.getElementById('transactionModal');
    if (event.target == modal) {
        closeModal();
    }
}

// 5. Tự động chạy hàm này khi trang web tải xong
document.addEventListener('DOMContentLoaded', () => {
    loadFinancialData();
    document.getElementById('filterType').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);
});