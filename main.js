import { auth, db } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, addDoc, setDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- 1. GLOBAL UTILS ---
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

// PEMBERSIH ANGKA (PENTING: Agar tabel tidak kosong jika ada data error)
const parseNumber = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Hapus huruf, Rp, titik, koma, spasi
    const cleanStr = String(val).replace(/[^0-9.-]+/g, ""); 
    return Number(cleanStr) || 0;
};

const resizeImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image(); img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas'); const max = 600;
            const scale = max / img.width; canvas.width = max; canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
});

// --- 2. UI HELPERS ---
function renderBottomNav(pageId) {
    if (pageId === 'page-login' || pageId === 'page-index') return;
    if (document.querySelector('.bottom-nav')) return;
    const navHTML = `
    <nav class="bottom-nav">
        <a href="dashboard.html" class="nav-item ${pageId==='page-dashboard'?'active':''}"><i class="fas fa-home"></i><span>Home</span></a>
        <a href="pesanan.html" class="nav-item ${pageId==='page-pesanan'||pageId==='page-tambah-pesanan'?'active':''}"><i class="fas fa-clipboard-list"></i><span>Pesanan</span></a>
        <a href="data_karyawan.html" class="nav-item ${pageId==='page-data-karyawan'||pageId==='page-tambah-karyawan'?'active':''}"><i class="fas fa-users"></i><span>Karyawan</span></a>
        <a href="slip_gaji.html" class="nav-item ${pageId==='page-slip-gaji'||pageId==='page-hitung-gaji'||pageId==='page-rekapan-gaji'?'active':''}"><i class="fas fa-wallet"></i><span>Keuangan</span></a>
    </nav>`;
    document.body.insertAdjacentHTML('beforeend', navHTML);
}
function setupImageModal() {
    if(!document.getElementById('imgModal')) {
        const modalHtml = `<div id="imgModal" style="display:none;position:fixed;z-index:10002;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.9);justify-content:center;align-items:center;"><span style="position:absolute;top:20px;right:30px;color:white;font-size:40px;cursor:pointer;" onclick="closeImage()">&times;</span><img id="imgModalContent" style="max-width:95%;max-height:95%;border:2px solid white;border-radius:5px;"></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}
window.viewImage = (src) => { document.getElementById('imgModal').style.display="flex"; document.getElementById('imgModalContent').src=src; };
window.closeImage = () => { document.getElementById('imgModal').style.display="none"; };

// --- 3. AUTH CHECK ---
onAuthStateChanged(auth, async (user) => {
    const pageId = document.body.id;
    setupImageModal(); renderBottomNav(pageId);
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const role = userDoc.exists() ? userDoc.data().role : 'user';
            if (role !== 'admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            if (pageId === 'page-login') window.location.href = 'dashboard.html';
            await initPageLogic(pageId, role);
        } catch (e) { console.error(e); }
    } else {
        if (pageId !== 'page-login' && pageId !== 'page-index') window.location.href = 'login.html';
        if (pageId === 'page-login') return; 
    }
});

// --- 4. LOGIKA UTAMA ---
async function initPageLogic(pageId, role) {
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

    if (pageId === 'page-login') return; 

    // DATA MAPS
    let ulosDataMap = {}; 
    let karyawanDataMap = {}; 

    // DROPDOWN
    const dropUlos = document.getElementById('nama_ulos');
    if (dropUlos) {
        try {
            const q = query(collection(db, 'ulos'), orderBy('nama'));
            const snap = await getDocs(q); const mapUpah = {};
            dropUlos.innerHTML = '<option value="">-- Pilih Ulos --</option>';
            snap.forEach(d => {
                const data = d.data();
                dropUlos.innerHTML += `<option value="${data.nama}">${data.nama}</option>`;
                ulosDataMap[data.nama] = { id: d.id, foto: data.foto, stock: Number(data.stock)||0, harga: Number(data.harga)||0 };
                mapUpah[data.nama] = data.upah || 0;
            });
            dropUlos.addEventListener('change', function() {
                const data = ulosDataMap[this.value];
                const img = document.getElementById('preview_foto'); if(img) { img.style.display=(data&&data.foto)?'block':'none'; if(data) img.src=data.foto; }
                const stok = document.getElementById('info_stok'); if(stok&&data) stok.innerHTML=`Stok: <strong>${data.stock}</strong>`;
                const upah = document.getElementById('upah_lembar'); if(upah) upah.value = mapUpah[this.value]||0;
            });
        } catch (e) { console.error(e); }
    }
    
    const dropKar = document.getElementById('nama_karyawan');
    if (dropKar) {
        try {
            const q = query(collection(db, 'karyawan'), orderBy('nama'));
            const snap = await getDocs(q);
            dropKar.innerHTML = '<option value="">-- Pilih Karyawan --</option>';
            snap.forEach(d => {
                const dt = d.data();
                dropKar.innerHTML += `<option value="${dt.nama}">${dt.nama}</option>`;
                karyawanDataMap[dt.nama] = { rekening: dt.rekening || '-', bank: dt.bank || 'Bank', nama_rekening: dt.nama_rekening || '' };
            });
        } catch (e) { console.error(e); }
    }

    // HITUNG GAJI
    if (pageId === 'page-hitung-gaji') {
        const btnHitung = document.getElementById('btnHitung');
        if (btnHitung) btnHitung.addEventListener('click', () => {
            const upah = parseNumber(document.getElementById('upah_lembar').value);
            const jumlah = parseNumber(document.getElementById('jumlah').value);
            const pakan = parseNumber(document.getElementById('pakan').value);
            const pot = parseNumber(document.getElementById('pot_air').value) + parseNumber(document.getElementById('pot_wifi').value) + parseNumber(document.getElementById('pot_stell').value) + parseNumber(document.getElementById('pot_lain').value);
            const totalPakan = pakan * jumlah;
            const bersih = (upah * jumlah) - totalPakan - pot;
            document.getElementById('gaji_bersih_tampil').value = formatRupiah(bersih);
            document.getElementById('gajiBersih').value = bersih;
        });
    }

    // SIMPAN DATA
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button'); const old = btn.innerText;
            if(btn) { btn.innerText = 'Menyimpan...'; btn.disabled = true; }

            try {
                let col = '', redirect = '', hasImage = false;
                if(pageId==='page-tambah-ulos'){ col='ulos'; redirect='ulos.html'; hasImage=true; }
                else if(pageId==='page-tambah-karyawan'){ col='karyawan'; redirect='data_karyawan.html'; hasImage=true; }
                else if(pageId==='page-tambah-pesanan'){ col='pesanan'; redirect='pesanan.html'; }
                else if(pageId==='page-hitung-gaji'){ col='gaji'; redirect='rekapan_gaji.html'; }
                else if(pageId==='page-tambah-terjual'){ col='terjual'; redirect='riwayat_terjual.html'; }

                const formData = {};
                e.target.querySelectorAll('input, select').forEach(el => {
                    if(el.id&&el.type!=='submit'&&el.type!=='file'&&el.id!=='gaji_bersih_tampil') formData[el.id]=el.value;
                });

                if (hasImage) {
                    const f = document.querySelector('input[type="file"]');
                    if (f && f.files[0]) formData.foto = await resizeImage(f.files[0]);
                }
                if (pageId === 'page-tambah-pesanan' || pageId === 'page-tambah-terjual') {
                    const img = document.getElementById('preview_foto');
                    if(img && img.src && img.style.display !== 'none') formData.foto = img.src;
                }

                if (pageId === 'page-hitung-gaji') {
                    // Pakai parseNumber agar aman
                    const p = parseNumber(formData.pakan);
                    const j = parseNumber(formData.jumlah);
                    formData.pakan = p * j; 
                    
                    if (formData.nama_karyawan && karyawanDataMap[formData.nama_karyawan]) {
                        const k = karyawanDataMap[formData.nama_karyawan];
                        formData.rekening = k.rekening; formData.bank = k.bank; formData.nama_rekening = k.nama_rekening;
                    }
                }
                formData.timestamp = new Date();

                if (pageId === 'page-tambah-terjual') {
                    const urlParams = new URLSearchParams(window.location.search);
                    if(!urlParams.get('id')) {
                        const info = ulosDataMap[formData.nama_ulos];
                        if (!info) throw new Error("Pilih Ulos!");
                        if (info.stock < parseNumber(formData.jumlah)) throw new Error("Stok Kurang!");
                        await updateDoc(doc(db, 'ulos', info.id), { stock: info.stock - parseNumber(formData.jumlah) });
                        formData.total_harga = parseNumber(formData.jumlah) * info.harga;
                    }
                }

                const urlParams = new URLSearchParams(window.location.search);
                const editId = urlParams.get('id');
                if (editId) {
                    if(!formData.foto && !pageId.includes('pesanan') && !pageId.includes('terjual')) delete formData.foto;
                    await updateDoc(doc(db, col, editId), formData); alert("Update Berhasil!");
                } else {
                    await addDoc(collection(db, col), formData); alert("Simpan Berhasil!");
                }
                window.location.href = redirect;

            } catch (err) { alert("Gagal: " + err.message); if(btn) { btn.innerText = old; btn.disabled = false; } }
        });
    }

    // LIST DATA & REKAPAN GAJI
    const container = document.getElementById('dataContainer');
    const tbody = document.getElementById('tbodyGaji');
    
    if (container || tbody) {
        let col='', renderFunc=null;
        if(pageId==='page-ulos'){ col='ulos'; renderFunc=renderUlos; }
        else if(pageId==='page-data-karyawan'){ col='karyawan'; renderFunc=renderKaryawan; }
        else if(pageId==='page-pesanan'){ col='pesanan'; renderFunc=renderPesanan; }
        else if(pageId==='page-riwayat-terjual'){ col='terjual'; renderFunc=renderTerjual; }
        else if(pageId==='page-slip-gaji'){ col='gaji'; renderFunc=renderSlipGaji; }
        else if(pageId==='page-rekapan-gaji'){ col='gaji'; } 

        const q = query(collection(db, col), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);

        if (container) {
            container.innerHTML = '';
            if(snap.empty) container.innerHTML = '<p class="text-center" style="margin-top:20px;">Data kosong.</p>';
            else snap.forEach(d => container.appendChild(renderFunc(d, role==='admin')));
        }

        // REKAPAN GAJI (TABEL)
        if (tbody) { 
            let tG=0, tP=0, tU=0, no=1; tbody.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data(); 
                // Pakai parseNumber agar data string/rusak tidak bikin error
                const pakan = parseNumber(d.pakan);
                const jumlah = parseNumber(d.jumlah);
                const gaji = parseNumber(d.gajiBersih);
                const potLain = parseNumber(d.pot_air) + parseNumber(d.pot_wifi) + parseNumber(d.pot_stell) + parseNumber(d.pot_lain);
                
                tG += gaji; tP += pakan; tU += jumlah;
                
                tbody.innerHTML += `
                <tr>
                    <td>${no++}</td>
                    <td style="text-align:left;">${d.nama_karyawan}</td>
                    <td>${d.nama_ulos}<br><small>${jumlah} lbr</small></td>
                    <td style="color:red">${formatRupiah(pakan)}</td>
                    <td>${formatRupiah(potLain)}</td>
                    <td style="font-weight:bold;color:green">${formatRupiah(gaji)}</td>
                    ${role==='admin'?`<td><button class="btn-danger btn-sm" onclick="hapus('gaji','${doc.id}')">X</button></td>`:''}
                </tr>`;
            });
            
            // Update Total
            if(document.getElementById('t_ulos')) document.getElementById('t_ulos').innerText = tU;
            if(document.getElementById('t_pakan')) document.getElementById('t_pakan').innerText = formatRupiah(tP);
            if(document.getElementById('t_gaji')) document.getElementById('t_gaji').innerText = formatRupiah(tG);

            if(document.getElementById('info_ulos')) document.getElementById('info_ulos').innerText = tU;
            if(document.getElementById('info_pakan')) document.getElementById('info_pakan').innerText = formatRupiah(tP);
            if(document.getElementById('info_gaji')) document.getElementById('info_gaji').innerText = formatRupiah(tG);
        }
    }
}

// RENDER HELPER
function createCard(img, info, isAdmin, col, id, page) {
    let imgHTML = img ? `<div style="display:flex;flex-direction:column;align-items:center;margin-right:15px;"><img src="${img}" class="data-img" onclick="viewImage('${img}')"><div style="display:flex;gap:5px;"><button onclick="viewImage('${img}')" class="btn-mini" style="background:#17a2b8;">👁️</button><a href="${img}" target="_blank" download class="btn-mini" style="background:#28a745;">⬇️</a></div></div>` : '';
    const div=document.createElement('div'); div.className='data-item';
    div.innerHTML=`${imgHTML}<div class="data-info" style="flex:1;">${info}</div>${isAdmin ? `<div class="admin-actions"><a href="${page}?id=${id}" class="btn-warning btn-sm" style="text-align:center;">✏️</a><button class="btn-danger btn-sm" onclick="hapus('${col}','${id}')">🗑️</button></div>`:''}`;
    return div;
}

function renderUlos(d, adm) { const dt=d.data(); return createCard(dt.foto, `<h4>${dt.nama} (${dt.jenis})</h4><p>Stok: <strong>${dt.stock}</strong> | Harga: ${formatRupiah(dt.harga)}</p>`, adm, 'ulos', d.id, 'tambah_data_ulos.html'); }
function renderKaryawan(d, adm) { const dt=d.data(); let wa="#"; if(dt.hp) wa=`https://wa.me/${dt.hp.toString().replace(/\D/g,'').replace(/^0/,'62')}`; const an = dt.nama_rekening ? `<br><small style="color:#666;">(A.n. ${dt.nama_rekening})</small>` : ''; return createCard(dt.foto, `<h4>${dt.nama}</h4><p><a href="${wa}" style="color:green;text-decoration:none;"><i class="fab fa-whatsapp"></i> Chat WA</a></p><p style="font-size:0.8rem;background:#f5f5f5;padding:5px;border-radius:5px;">${dt.bank} - <strong>${dt.rekening}</strong>${an} <i class="fas fa-copy" onclick="salin('${dt.rekening}')" style="cursor:pointer;color:maroon;"></i></p>`, adm, 'karyawan', d.id, 'tambah_karyawan.html'); }
function renderPesanan(d, adm) { const dt=d.data(); return createCard(dt.foto, `<h4>${dt.nama_ulos}</h4><p>Jml: <strong>${dt.jumlah}</strong> | Oleh: ${dt.nama_karyawan}</p>`, adm, 'pesanan', d.id, 'tambah_pesanan.html'); }
function renderTerjual(d, adm) { const dt=d.data(); const tgl=dt.timestamp?dt.timestamp.toDate().toLocaleDateString():'-'; const tot=dt.total_harga?formatRupiah(dt.total_harga):'-'; return createCard(dt.foto, `<h4 style="color:green;">Terjual: ${dt.nama_ulos}</h4><p>Jml: <strong>${dt.jumlah}</strong> | Tgl: ${tgl}</p><p>Total: <strong>${tot}</strong></p>`, adm, 'terjual', d.id, '#'); }
function renderSlipGaji(d, adm) { 
    const dt=d.data(); const tgl=dt.timestamp?dt.timestamp.toDate().toLocaleDateString():'-';
    const anInfo = dt.nama_rekening ? `<br><span style="font-size:0.8rem; color:#555;">(A.n. ${dt.nama_rekening})</span>` : '';
    const rek = dt.rekening ? `<div style="margin-top:10px;padding-top:5px;border-top:1px dashed #ccc;text-align:center;"><p style="font-size:0.7rem;color:#888;">Transfer:</p><strong>${dt.bank}</strong><br><span style="font-size:1.1rem;letter-spacing:1px;">${dt.rekening}</span>${anInfo} <i class="fas fa-copy" onclick="salin('${dt.rekening}')" style="cursor:pointer;color:blue;"></i></div>` : '';
    return createCard(null, `<div id="slip-${d.id}" class="slip-card" style="border:none;box-shadow:none;padding:0;"><div style="border:2px dashed #800000;border-radius:15px;padding:20px;background:white;max-width:350px;margin:0 auto;"><div style="text-align:center;margin-bottom:15px;border-bottom:2px solid #D4AF37;padding-bottom:10px;"><img src="borsin.png" style="width:60px;height:60px;border-radius:50%;border:3px solid #D4AF37;margin-bottom:5px;object-fit:cover;"><h3 style="margin:0;color:#800000;">BORSIN TENUN</h3><p style="font-size:0.8rem;color:#555;">Slip Gaji Resmi</p><small style="background:#800000;color:white;padding:2px 8px;border-radius:10px;">${tgl}</small></div><div style="font-size:0.9rem;"><div style="display:flex;justify-content:space-between;"><span>Nama:</span><strong>${dt.nama_karyawan}</strong></div><div style="display:flex;justify-content:space-between;"><span>Ulos:</span><span>${dt.nama_ulos} (${dt.jumlah})</span></div><div style="display:flex;justify-content:space-between;color:red;"><span>Pot. Pakan:</span><span>- ${formatRupiah(dt.pakan||0)}</span></div><div style="display:flex;justify-content:space-between;border-top:2px solid #eee;margin-top:10px;padding-top:5px;"><span style="font-weight:bold;color:#800000;">TOTAL:</span><span style="font-weight:bold;color:green;">${formatRupiah(dt.gajiBersih)}</span></div></div>${rek}</div></div><div class="no-print" style="text-align:center;margin-top:15px;"><button onclick="cetakSlip('slip-${d.id}')" class="btn-sm" style="background:#800000;color:white;padding:10px 25px;border-radius:50px;">🖨️ Cetak</button> ${adm?`<button onclick="hapus('gaji','${d.id}')" class="btn-danger btn-sm" style="border-radius:50px;padding:10px;">🗑️</button>`:''}</div>`, adm, 'gaji', d.id, '#'); 
}

window.hapus = async (col, id) => { if(confirm("Hapus Data?")) { await deleteDoc(doc(db, col, id)); window.location.reload(); } };
window.salin = (t) => { navigator.clipboard.writeText(t).then(()=>alert("Disalin: "+t)).catch(()=>prompt("Salin:",t)); };
window.cetakSlip = (id) => { const c=document.getElementById(id).innerHTML; const o=document.body.innerHTML; document.body.innerHTML=`<div class="container" style="margin-top:50px;"><div class="slip-card">${c}</div></div>`; window.print(); document.body.innerHTML=o; window.location.reload(); };
    
