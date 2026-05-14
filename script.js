
  // ==========================================
// 1. KONFIGURASI API & KONEKSI BACKEND
// ==========================================
// GANTI STRING DI BAWAH DENGAN URL WEB APP GOOGLE APPS SCRIPT KAMU
const API_URL = "https://script.google.com/macros/s/AKfycbyjJnM7nHiARFQ4q1azEYbIeUPzHq285Encg9yk1_QFSgE07qRzmXNlwaKwMr9kz7JU/exec"; 

// Fungsi universal pengganti google.script.run
async function callAPI(actionName, payloadData = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      // Menggunakan text/plain agar tidak memicu pemblokiran CORS Preflight di browser
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
      body: JSON.stringify({ action: actionName, payload: payloadData })
    });
    return await response.json();
  } catch (error) {
    console.error(`Error pada aksi ${actionName}:`, error);
    throw error;
  }
}



  let currentUser = null;
  let allUsulanAdminList = []; 
  // --- VARIABEL PAGINATION ---
  const limit = 15;
  let halPegawai = 1, halUsulan = 1, halLaporan = 1;
  let usulanFilteredList = [];
  let laporanFilteredList = [];

  let fileCount = 0;
  let asnDataList = [];
  let asnFilteredList = [];

  // ================= INIT & LOGIN =================
  window.onload = function() {
    loadSettingsInit();
    const session = localStorage.getItem('asn_session');
    if (session) {
      currentUser = JSON.parse(session);
      tampilkanAplikasi(currentUser);
    }
  };

  function showLoading(show) { document.getElementById('loading-overlay').classList.toggle('view-hidden', !show); }


// =================================================================
// TIMPA FUNGSI-FUNGSI LAMA KAMU DENGAN KODE DI BAWAH INI
// =================================================================

async function handleLogin(e) { 
  e.preventDefault();
  const nip = document.getElementById('nip').value;
  const pass = document.getElementById('password').value;
  showLoading(true);
  
  try {
    const res = await callAPI('login', { nip: nip, password: pass });
    showLoading(false);
    if(res.success) {
      currentUser = res;
      localStorage.setItem('asn_session', JSON.stringify(currentUser));
      Swal.fire({icon: 'success', title: 'Login Berhasil', timer: 1500, showConfirmButton: false})
        .then(() => tampilkanAplikasi(res));
    } else {
      Swal.fire('Login Gagal', res.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    Swal.fire('Error Sistem', 'Gagal memproses ke Server', 'error');
  }
}

async function navigate(viewName) {
  // 1. Sembunyikan semua halaman, tampilkan halaman yang dituju
  document.querySelectorAll('.content-section').forEach(el => el.classList.add('view-hidden'));
  let targetEl = document.getElementById('content-' + viewName);
  if(targetEl) targetEl.classList.remove('view-hidden');

  // 2. LOGIKA KELOLA PEGAWAI (Caching)
  if (viewName === 'admin-pegawai') {
    if (asnDataList.length === 0) loadDataASN(); 
    else renderTabelASN(); 
  }
  
  // 3. LOGIKA RIWAYAT USER
  if (viewName === 'status-usulan') {
    loadRiwayatUser(); 
  }
  
  // =========================================================
  // 4. LOGIKA BARU: KELOLA USULAN, DASHBOARD, & LAPORAN
  // =========================================================
  
  if (viewName === 'admin-usulan') {
    // SELALU ambil data terbaru dari server (agar tidak ada usulan yang terlewat)
    loadDataUsulanAdmin(); 
  } 
  else if (viewName === 'admin-dashboard' || viewName === 'admin-laporan') {
    // Untuk Dashboard dan Laporan, JANGAN loading ke server jika data sudah ada
    if (allUsulanAdminList.length === 0) {
       // Panggil server HANYA jika admin baru pertama kali login dan data masih kosong mutlak
       loadDataUsulanAdmin(); 
    } else {
       // Render instan dari memori (0 detik, sangat cepat!)
       if (viewName === 'admin-dashboard') renderGrafikAdmin();
       if (viewName === 'admin-laporan') previewLaporan();
    }
  }
  // =========================================================

  // 5. Mengisi pengaturan admin diam-diam (tanpa layar loading)
  if (viewName === 'admin-setting' && currentUser) {
    document.getElementById('set-admin-nip').value = currentUser.nip;
    document.getElementById('set-admin-nama').value = currentUser.nama;
    try {
      callAPI('getPasswordAdmin', { nip: currentUser.nip }).then(pass => {
         document.getElementById('set-admin-pass').value = pass;
      });
    } catch(e) {}
  }

  // 6. Update data text ringan di Dashboard
  if (viewName === 'admin-dashboard' && currentUser) {
    const elNamaAdmin = document.getElementById('dash-admin-nama');
    if(elNamaAdmin) elNamaAdmin.innerText = currentUser.nama.split(" ")[0]; 
  }
  if (viewName === 'user-dashboard' && currentUser) {
    const elNama = document.getElementById('dash-user-nama');
    if(elNama) elNama.innerText = currentUser.nama.split(" ")[0]; 
    const elStatus = document.getElementById('dash-user-status');
    if(elStatus) elStatus.innerText = currentUser.status + " (" + currentUser.golongan + ")";
  }

  // 7. Update profil pegawai diam-diam
  if (viewName === 'user-profil' && currentUser) {
    document.getElementById('prof-nip').value = currentUser.nip;
    document.getElementById('prof-nama').value = currentUser.nama;
    document.getElementById('prof-status').value = currentUser.status;
    document.getElementById('prof-jabatan').value = currentUser.jabatan;
    document.getElementById('prof-unit').value = currentUser.unit;
    document.getElementById('prof-kabkota').value = currentUser.kabkota || "Kota Jambi";
    
    if (document.getElementById('prof-email') && currentUser.email) {
       document.getElementById('prof-email').value = currentUser.email !== "-" ? currentUser.email : "";
    }
    
    callAPI('getSemuaASN').then(res => {
      let userDb = res.data.find(i => i.nip.toString() === currentUser.nip.toString());
      if(userDb) document.getElementById('prof-pass').value = userDb.password;
    }).catch(e=>{});

    renderDropdownGolonganUser(currentUser.status, currentUser.golongan);
  }

  if (viewName === 'form-usulan' && currentUser) {
    document.getElementById('form-nip').value = currentUser.nip;
    document.getElementById('form-nama').value = currentUser.nama;
    document.getElementById('form-golongan').value = currentUser.golongan;
    document.getElementById('form-jabatan').value = currentUser.jabatan;
    document.getElementById('form-unit').value = currentUser.unit;
    inisiasiFormUpload();
  }

  // Tutup menu sidebar saat di mode HP
  const sidebar = document.getElementById('sidebar');
  if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
    toggleMobileMenu();
  }
}

async function loadSettingsInit() {
  try {
    const resAPI = await callAPI('getSettings');
    const res = resAPI.data;
    if (!res) return; // Jika kosong, hentikan proses
    
    // Fungsi bantuan agar kode lebih ringkas
    const setVal = (id, val) => { let el = document.getElementById(id); if(el) el.value = val; };
    const setTxt = (id, val) => { let el = document.getElementById(id); if(el) el.innerText = val; };
    const setHtml = (id, val) => { let el = document.getElementById(id); if(el) el.innerHTML = val; };

    // Update teks identitas Instansi
    setTxt('landing-pemda', res.Pemda || "PEMERINTAH DAERAH");
    setTxt('landing-dinas', res.Nama_Dinas || "DINAS PENDIDIKAN");
    setTxt('sidebar-app-name', "e-UPG " + (res.Pemda || ""));
    setTxt('login-alamat', res.Alamat || ""); 
    
    setTxt('print-pemda', res.Pemda || "PEMERINTAH DAERAH");
    setTxt('print-dinas', res.Nama_Dinas || "NAMA INSTANSI");
    setTxt('print-alamat', res.Alamat || "");
    
    // Update Kontak
    let kontakInfo = [];
    if(res.Email_Dinas) kontakInfo.push(res.Email_Dinas);
    if(res.Telp_Dinas) kontakInfo.push(res.Telp_Dinas);
    if(res.Web_Dinas) kontakInfo.push(res.Web_Dinas);
    setHtml('print-kontak', kontakInfo.join(" | "));

    let elWa = document.getElementById('link-wa-admin');
    let elTelp = document.getElementById('link-telp-admin');
    let elEmail = document.getElementById('link-email-admin');
    
    if (elWa && res.HP_Admin) {
      let noWa = res.HP_Admin.startsWith('0') ? '62' + res.HP_Admin.substring(1) : res.HP_Admin;
      elWa.href = "https://wa.me/" + noWa;
    }
    if (elTelp && res.Telp_Dinas) elTelp.href = "tel:" + res.Telp_Dinas;
    if (elEmail && res.Email_Dinas) elEmail.href = "mailto:" + res.Email_Dinas;

    // Update Gambar Logo
    if(res.Logo_Instansi_URL) {
      ['landing-logo-instansi', 'print-logo-instansi', 'preview-logo-instansi', 'mobile-header-logo', 'sidebar-logo'].forEach(id => {
        let el = document.getElementById(id);
        if(el) { el.src = res.Logo_Instansi_URL; el.classList.remove('hidden'); }
      });
      setVal('set-logo-instansi-base64', res.Logo_Instansi_URL);
    }

    if(res.Logo_URL) {
      ['landing-logo-dinas', 'preview-logo-dinas'].forEach(id => {
        let el = document.getElementById(id);
        if(el) { el.src = res.Logo_URL; el.classList.remove('hidden'); }
      });
      setVal('set-logo-dinas-base64', res.Logo_URL);
    }
    
    setTxt('mobile-header-dinas', res.Nama_Dinas || "Dinas Pendidikan");
    setTxt('sidebar-dinas', res.Nama_Dinas || "Dinas Pendidikan");
    
    // Isi otomatis ke form Pengaturan
    setVal('set-pemda', res.Pemda || "");
    setVal('set-nama', res.Nama_Dinas || "");
    setVal('set-alamat', res.Alamat || "");
    setVal('set-email', res.Email_Dinas || "");
    setVal('set-telp', res.Telp_Dinas || "");
    setVal('set-web', res.Web_Dinas || "");
    setVal('set-hp', res.HP_Admin || "");

    // Isi kolom TTD (Jika sudah pernah disimpan)
    setVal('set-ttd-kepala-nama', res.TTD_Kepala_Nama || "");
    setVal('set-ttd-kepala-pangkat', res.TTD_Kepala_Pangkat || "");
    setVal('set-ttd-kepala-nip', res.TTD_Kepala_NIP || "");
    setVal('set-ttd-bendahara-nama', res.TTD_Bendahara_Nama || "");
    setVal('set-ttd-bendahara-pangkat', res.TTD_Bendahara_Pangkat || "");
    setVal('set-ttd-bendahara-nip', res.TTD_Bendahara_NIP || "");

    // Panggil Dropdown Unit Kerja
    loadUnitKerjaList();
  } catch(err) { 
    console.error("Gagal memuat pengaturan awal: ", err); 
  }
}

async function loadUnitKerjaList() {
  try {
    const res = await callAPI('getUnitKerjaList');
    const datalist = document.getElementById('data-unit-kerja');
    const filterUnit = document.getElementById('filter-asn-unit');
    
    if (datalist) datalist.innerHTML = '';
    if (filterUnit) filterUnit.innerHTML = '<option value="Semua">Semua Unit Kerja</option>';
    
    res.forEach(unit => {
      if (datalist) datalist.innerHTML += `<option value="${unit}">`;
      if (filterUnit) filterUnit.innerHTML += `<option value="${unit}">${unit}</option>`;
    });
  } catch(e) {}
}

async function submitLupaPassword(e) {
  e.preventDefault();
  const nip = document.getElementById('lupa-nip').value;
  const email = document.getElementById('lupa-email').value;

  showLoading(true);
  try {
    const res = await callAPI('prosesKirimLupaPassword', { nip: nip, email: email });
    showLoading(false);
    if (res.success) {
      closeModalLupaPass();
      Swal.fire('Terkirim!', res.message, 'success');
    } else {
      Swal.fire('Gagal Verifikasi', res.message, 'error');
    }
  } catch(err) { showLoading(false); Swal.fire('Error', 'Gagal memproses ke server', 'error'); }
}

async function prosesSubmitUsulan(e) {
  e.preventDefault();
  const fileRows = document.querySelectorAll('#container-file-upload > div');
  if (fileRows.length === 0) return Swal.fire('Gagal', 'Minimal 1 berkas wajib dilampirkan!', 'warning');

  let filesData = [];
  for (let row of fileRows) {
    const labelInput = row.querySelector('.file-label').value;
    const fileInput = row.querySelector('.file-input').files[0];

    if (!labelInput) return Swal.fire('Gagal', 'Semua nama/label berkas wajib diisi!', 'warning');
    if (!fileInput) return Swal.fire('Gagal', 'Silakan pilih file PDF!', 'warning');
    if (fileInput.type !== 'application/pdf') return Swal.fire('Ditolak', `Bukan format PDF!`, 'error');
    if (fileInput.size > 300 * 1024) return Swal.fire('Ditolak', `Ukuran file melebihi batas 300KB!`, 'error');

    const base64 = await toBase64(fileInput);
    filesData.push({ label: labelInput, name: fileInput.name, data: base64 });
  }

  const jenis = document.getElementById('input-jenis-usulan').value;
  
  let detailJSON = {
    golongan_usulan: document.getElementById('form-golongan').value,
    jabatan_usulan: document.getElementById('form-jabatan').value,
    unit_usulan: document.getElementById('form-unit').value,
    keterangan: document.getElementById('form-keterangan').value
  };
  const formatTMT = (tgl) => { if(!tgl) return "-"; let d = new Date(tgl); return `${("0"+d.getDate()).slice(-2)}-${("0"+(d.getMonth()+1)).slice(-2)}-${d.getFullYear()}`; };

  if (jenis === 'Kenaikan Gaji Berkala (KGB)') {
    detailJSON.no_sk = document.getElementById('form-kgb-sk').value;
    detailJSON.tmt = formatTMT(document.getElementById('form-kgb-tmt').value);
    detailJSON.gaji_lama = document.getElementById('form-kgb-gaji-lama').value.replace(/\./g, '');
    detailJSON.gaji_baru = document.getElementById('form-kgb-gaji-baru').value.replace(/\./g, '');
  } else if (jenis === 'Kenaikan Pangkat') {
    detailJSON.no_sk_pangkat = document.getElementById('form-pkt-sk').value;
    detailJSON.golongan_lama = document.getElementById('form-pkt-gol-lama').value;
    detailJSON.golongan_baru = document.getElementById('form-pkt-gol-baru').value;
    detailJSON.jenis_sk = document.getElementById('form-pkt-jenis').value;
    detailJSON.tmt_pangkat = formatTMT(document.getElementById('form-pkt-tmt').value);
    detailJSON.gaji_lama = document.getElementById('form-pkt-gaji-lama').value.replace(/\./g, '');
    detailJSON.gaji_baru = document.getElementById('form-pkt-gaji-baru').value.replace(/\./g, '');
  } else if (jenis === 'Perubahan Tunjangan Keluarga') {
    detailJSON.status_lama = document.getElementById('form-kel-status-lama').value;
    detailJSON.status_baru = document.getElementById('form-kel-status-baru').value;
  } else if (jenis === 'Perubahan Jabatan') {
    detailJSON.no_sk_jabatan = document.getElementById('form-jab-sk').value;
    detailJSON.tmt_jabatan = formatTMT(document.getElementById('form-jab-tmt').value);
    detailJSON.jabatan_lama = document.getElementById('form-jab-lama').value;
    detailJSON.jabatan_baru = document.getElementById('form-jab-baru').value;
    detailJSON.tunjangan_jabatan = document.getElementById('form-jab-tunj').value.replace(/\./g, '');
  }

  const payload = { nip: currentUser.nip, nama: currentUser.nama, jenis: jenis, detail: detailJSON, files: filesData };
  
  showLoading(true);
  try {
    const res = await callAPI('submitUsulan', payload);
    showLoading(false);
    if(res.success) { 
      Swal.fire('Sukses', res.message, 'success'); 
      document.getElementById('form-submit-usulan').reset(); 
      ubahFormDinamis(); 
      inisiasiFormUpload(); 
      navigate('status-usulan'); 
    }
    else Swal.fire('Error', res.message, 'error');
  } catch(err) { showLoading(false); Swal.fire('Error', 'Gagal memproses ke server', 'error'); }
}

async function simpanProfilUser(e) {
  e.preventDefault();
  const payload = {
    nip: document.getElementById('prof-nip').value,
    jabatan: document.getElementById('prof-jabatan').value,
    golongan: document.getElementById('prof-golongan').value,
    unit: document.getElementById('prof-unit').value.replace(/tata usaha\s+/ig, '').trim(),
    kabkota: document.getElementById('prof-kabkota').value,
    password: document.getElementById('prof-pass').value,
    email: document.getElementById('prof-email').value 
  };

  showLoading(true);
  try {
    const res = await callAPI('updateProfilPegawai', payload);
    showLoading(false);
    if(res.success) {
      Swal.fire('Sukses', 'Data berhasil disinkronisasi!', 'success');
      currentUser.golongan = payload.golongan;
      currentUser.jabatan = payload.jabatan;
      currentUser.unit = payload.unit;
      currentUser.kabkota = payload.kabkota;
      localStorage.setItem('asn_session', JSON.stringify(currentUser));
    } else { Swal.fire('Gagal', res.message, 'error'); }
  } catch(err) { showLoading(false); Swal.fire('Error', 'Gagal memproses ke server', 'error'); }
}

async function loadRiwayatUser() {
  const tbody = document.getElementById('table-riwayat-body');
  
  // Tampilkan indikator loading di dalam tabel tanpa menutup seluruh layar
  tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-blue-600 font-bold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Mengambil riwayat...</td></tr>';
  
  try {
    const data = await callAPI('getRiwayatUsulan', { nip: currentUser.nip });
    tbody.innerHTML = ''; 
    
    if(data.length === 0) { 
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Belum ada usulan yang diajukan.</td></tr>'; 
      return; 
    }
    
    data.forEach(item => {
      let badge = item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : (item.status === 'Disetujui' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800');
      tbody.innerHTML += `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3 font-semibold text-xs text-gray-600">${item.id}</td>
          <td class="p-3 text-sm">${item.tanggal}</td>
          <td class="p-3 text-sm font-semibold">${item.jenis}</td>
          <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${badge}">${item.status}</span></td>
          <td class="p-3 text-sm italic text-gray-500">${item.catatan || '-'}</td>
        </tr>
      `;
    });
  } catch(err) { 
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500 font-bold">Gagal memuat data dari server.</td></tr>'; 
  }
}

async function loadDataUsulanAdmin() {
  showLoading(true);
  try {
    const res = await callAPI('getAllUsulanAdmin');
    showLoading(false);
    if (res.error) return Swal.fire('Error Data', res.message, 'error');

    allUsulanAdminList = res.list;
    usulanFilteredList = [...allUsulanAdminList];
    
    document.getElementById('stat-pending').innerText = res.stats.pending;
    document.getElementById('stat-setuju').innerText = res.stats.setuju;
    document.getElementById('stat-tolak').innerText = res.stats.tolak;

    renderGrafikAdmin();
    halUsulan = 1; renderTabelUsulan();
    previewLaporan(); 
  } catch (err) {
    showLoading(false);
    Swal.fire('Error', 'Gagal mengambil data usulan.', 'error');
  }
}

async function loadDataASN() {
  showLoading(true);
  try {
    const res = await callAPI('getSemuaASN');
    showLoading(false);
    asnDataList = res.data.filter(item => item.role !== 'Admin'); 
    asnFilteredList = [...asnDataList];
    renderTabelASN();
  } catch(err) { showLoading(false); }
}

async function simpanDataASN(e) {
  e.preventDefault();
  let payload = {
    nip: document.getElementById('asn-nip').value,
    nama: document.getElementById('asn-nama').value,
    password: document.getElementById('asn-password').value,
    jabatan: document.getElementById('asn-jabatan').value,
    golongan: document.getElementById('asn-golongan').value,
    unit: document.getElementById('asn-unit').value.replace(/tata usaha\s+/ig, '').trim(),
    kabkota: document.getElementById('asn-kabkota').value,
    status: document.getElementById('asn-status').value,
    email: document.getElementById('asn-email').value
  };
  
  const nipTarget = document.getElementById('asn-rowidx').value; 
  showLoading(true);
  try {
    if(nipTarget === "") { 
      const res = await callAPI('simpanASN', payload);
      showLoading(false); 
      if(res.success){Swal.fire('Sukses',res.message,'success'); closeModalASN(); loadDataASN();} else Swal.fire('Gagal',res.message,'error');
    } else { 
      const res = await callAPI('updateASN', { nipTarget: nipTarget, payload: payload });
      showLoading(false); Swal.fire('Sukses',res.message,'success'); closeModalASN(); loadDataASN(); 
    }
  } catch(err) { showLoading(false); Swal.fire('Error', 'Gagal ke server', 'error'); }
}

async function hapusDataASN(nipTarget) {
  Swal.fire({ title: 'Yakin hapus data ini?', text: "Data tidak bisa dikembalikan!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus'
  }).then(async (result) => {
    if (result.isConfirmed) {
      showLoading(true);
      try {
        await callAPI('hapusASN', { nipTarget: nipTarget });
        showLoading(false); loadDataASN();
      } catch(e) { showLoading(false); }
    }
  });
}

async function prosesImportExcel(e) {
  const file = e.target.files[0]; if(!file) return;
  showLoading(true);
  const reader = new FileReader();
  
  const standarisasiPangkat = (inputGol) => {
    if (!inputGol) return "-";
    let str = String(inputGol).toUpperCase().replace(/\s/g, '').replace(/[\.\-]/g, '/'); 
    const mapPangkat = {
      "I/A": "Juru Muda (I/a)", "I/B": "Juru Muda Tk.I (I/b)", "I/C": "Juru (I/c)", "I/D": "Juru Tk.I (I/d)",
      "II/A": "Pengatur Muda (II/a)", "II/B": "Pengatur Muda Tk.I (II/b)", "II/C": "Pengatur (II/c)", "II/D": "Pengatur Tk.I (II/d)",
      "III/A": "Penata Muda (III/a)", "III/B": "Penata Muda Tk.I (III/b)", "III/C": "Penata (III/c)", "III/D": "Penata Tk.I (III/d)",
      "IV/A": "Pembina (IV/a)", "IV/B": "Pembina Tk.I (IV/b)", "IV/C": "Pembina Utama Muda (IV/c)", "IV/D": "Pembina Utama Madya (IV/d)", "IV/E": "Pembina Utama (IV/e)"
    };
    const daftarKunci = Object.keys(mapPangkat).sort((a, b) => b.length - a.length);
    for (let i = 0; i < daftarKunci.length; i++) {
      if (str.includes(daftarKunci[i])) return mapPangkat[daftarKunci[i]]; 
    }
    return inputGol; 
  };

  reader.onload = async function(event) {
    const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, {type: 'array'});
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
    let importArray = [];
    let errorNip = 0; 

    for(let i = 1; i < jsonData.length; i++) {
      if(jsonData[i].length > 0 && jsonData[i][0]) {
        let nipExcel = String(jsonData[i][0]).replace(/[^0-9]/g, '');
        if(nipExcel.length !== 18) { errorNip++; continue; }
        let statusRaw = String(jsonData[i][6] || 'PNS').toUpperCase().trim();
        let statusFix = (statusRaw.includes('PPPK') || statusRaw.includes('P3K')) ? 'PPPK' : 'PNS';
        let golRaw = jsonData[i][3] || '-';
        let golFix = (statusFix === 'PNS') ? standarisasiPangkat(golRaw) : golRaw;
        let unitRaw = String(jsonData[i][4] || '-').replace(/tata usaha\s+/ig, '').trim();

        importArray.push([
          nipExcel, jsonData[i][1] || '-',
          nipExcel, jsonData[i][2] || '-', golFix, 
          unitRaw, jsonData[i][5] || 'Kota Jambi', statusFix, 'User'                          
        ]);
      }
    }

    if(importArray.length > 0) {
      try {
        const res = await callAPI('importBatchASN', { importArray: importArray });
        showLoading(false); closeModalImport();
        if (errorNip > 0) Swal.fire('Sukses Parsial', `${res.message}. Namun, ada ${errorNip} baris gagal karena NIP tidak tepat 18 digit.`, 'warning');
        else Swal.fire('Sukses', res.message, 'success'); 
        loadDataASN(); 
      } catch(e) { showLoading(false); }
    } else { 
      showLoading(false); closeModalImport();
      Swal.fire('Gagal Import', 'Semua data gagal diimport. Pastikan NIP 18 digit.', 'error'); 
    }
  };
  reader.readAsArrayBuffer(file);
}

function hapusUsulanAdmin(idUsulan) {
  Swal.fire({
    title: 'Hapus Permanen?',
    text: "Ketik 'HAPUS' untuk mengonfirmasi:",
    input: 'text', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Hapus Data',
    preConfirm: (inputValue) => {
      if (inputValue !== 'HAPUS') { Swal.showValidationMessage("Ketik 'HAPUS' huruf besar."); return false; }
      return true;
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      showLoading(true);
      try {
        const res = await callAPI('hapusUsulan', { idUsulan: idUsulan });
        showLoading(false); 
        Swal.fire('Terhapus', res.message, 'success');
        loadDataUsulanAdmin();
      } catch(e) { showLoading(false); }
    }
  });
}

async function kirimStatusKeServer(idUsulan, statusBaru, catatan) {
  showLoading(true);
  try {
    const res = await callAPI('updateStatusUsulan', { idUsulan: idUsulan, statusBaru: statusBaru, catatan: catatan });
    showLoading(false);
    Swal.fire('Berhasil', res.message, 'success');
    closeModalDetail(); 
    loadDataUsulanAdmin(); 
  } catch(err) { showLoading(false); }
}

async function simpanProfilAdmin() {
  const nipBaru = document.getElementById('set-admin-nip').value;
  const namaBaru = document.getElementById('set-admin-nama').value;
  const passBaru = document.getElementById('set-admin-pass').value;

  showLoading(true);
  try {
    const res = await callAPI('ubahProfilAdmin', { nipLama: currentUser.nip, nipBaru: nipBaru, namaBaru: namaBaru, passBaru: passBaru });
    showLoading(false);
    if(res.success) {
      Swal.fire({ title: 'Berhasil!', text: res.message, icon: 'success', confirmButtonText: 'Login Ulang' }).then(() => { handleLogout(); });
    } else Swal.fire('Gagal', res.message, 'error');
  } catch(e) { showLoading(false); }
}

async function simpanPengaturan() {
  const p = document.getElementById('set-pemda').value;
  const n = document.getElementById('set-nama').value;
  const a = document.getElementById('set-alamat').value;
  const logoI = document.getElementById('set-logo-instansi-base64').value; 
  const logoD = document.getElementById('set-logo-dinas-base64').value; 
  const em = document.getElementById('set-email').value;
  const tlp = document.getElementById('set-telp').value;
  const wb = document.getElementById('set-web').value;
  const hp = document.getElementById('set-hp').value;
  
  // TAMBAHAN: Data TTD
  const ttdData = {
    kNama: document.getElementById('set-ttd-kepala-nama').value,
    kPangkat: document.getElementById('set-ttd-kepala-pangkat').value,
    kNip: document.getElementById('set-ttd-kepala-nip').value,
    bNama: document.getElementById('set-ttd-bendahara-nama').value,
    bPangkat: document.getElementById('set-ttd-bendahara-pangkat').value,
    bNip: document.getElementById('set-ttd-bendahara-nip').value,
  };
  
  showLoading(true);
  try {
    const res = await callAPI('saveSettings', { 
      pemda: p, nama: n, alamat: a, logoInstansi: logoI, logoDinas: logoD, email: em, telp: tlp, web: wb, hp: hp, ttd: ttdData 
    });
    showLoading(false);
    if (res.success) {
      Swal.fire('Berhasil', res.message, 'success'); 
      loadSettingsInit(); 
    } else {
      Swal.fire('Gagal', res.message, 'error');
    }
  } catch (err) {
    console.error("Detail Error Sistem:", err); 
    showLoading(false);
    Swal.fire('Error Sistem', 'Gagal mengirim data.', 'error');
  }
}

async function simpanPassAdmin() {
  const pass = document.getElementById('set-pass').value;
  if(pass.length < 5) return Swal.fire('Gagal', 'Password minimal 5 karakter', 'warning');
  showLoading(true);
  try {
    const res = await callAPI('ubahPasswordAdmin', { nip: currentUser.nip, passBaru: pass });
    showLoading(false);
    if(res.success){ Swal.fire('Berhasil', res.message, 'success'); document.getElementById('set-pass').value=''; }
    else Swal.fire('Gagal', res.message, 'error');
  } catch(e) { showLoading(false); }
}

async function jalankanBackup() {
  showLoading(true);
  try {
    const res = await callAPI('backupDatabase');
    showLoading(false); Swal.fire('Backup Sukses', res.message, 'success');
  } catch(e) { showLoading(false); }
}






// --- FUNGSI MATA PASSWORD ---
  function togglePassword() {
    const passInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      passInput.type = 'password';
      eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  }


 // --- LOGIC CROP LOGO (Transparan & Ukuran Aman) ---
  function prosesLogo(event, inputHiddenId, imgPreviewId) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        
        // Kita atur ke 150x150 agar ukuran Base64 format PNG tidak melebihi batas Google Sheet
        canvas.width = 150; canvas.height = 150;
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        
        // Bersihkan kanvas agar latarnya transparan (jangan diisi warna putih)
        ctx.clearRect(0, 0, 150, 150);
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 150, 150);
        
        // Gunakan format PNG agar mendukung transparansi
        const base64 = canvas.toDataURL('image/png');
        
        document.getElementById(inputHiddenId).value = base64;
        document.getElementById(imgPreviewId).src = base64;
        document.getElementById(imgPreviewId).classList.remove('hidden');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --- FUNGSI LOGOUT ---
  function handleLogout() {
    Swal.fire({
      title: 'Keluar Aplikasi?',
      text: "Anda akan mengakhiri sesi aktif saat ini.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Keluar!'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('asn_session');
        currentUser = null;
        document.getElementById('view-app').classList.add('view-hidden');
        document.getElementById('view-landing').classList.add('view-hidden');
        // Arahkan LANGSUNG KE LOGIN
        document.getElementById('view-login').classList.remove('view-hidden'); 
        document.getElementById('form-login').reset();
      }
    });
  }

 // --- FUNGSI PEMISAHAN MENU USER & ADMIN (UPDATE NATIVE MOBILE) ---
  function tampilkanAplikasi(user) {
    document.getElementById('view-landing').classList.add('view-hidden');
    document.getElementById('view-login').classList.add('view-hidden');
    document.getElementById('view-app').classList.remove('view-hidden');
    
    // Sidebar Komputer
    document.getElementById('sidebar-name').innerText = user.nama;
    document.getElementById('sidebar-nip').innerText = user.nip;
    document.getElementById('sidebar-role').innerText = user.role;

    let currentRole = String(user.role).trim().toLowerCase();

    // Sembunyikan semua elemen navigasi terlebih dahulu
    document.getElementById('menu-admin').classList.add('view-hidden');
    document.getElementById('menu-user').classList.add('view-hidden');
    document.getElementById('nav-bottom-admin').classList.add('view-hidden');
    document.getElementById('nav-bottom-user').classList.add('view-hidden');
    document.getElementById('btn-setting-mobile').classList.add('view-hidden');

    if(currentRole === 'admin') {
      document.getElementById('menu-admin').classList.remove('view-hidden'); // Sidebar Laptop
      document.getElementById('nav-bottom-admin').classList.remove('view-hidden'); // Nav Bawah HP
      document.getElementById('btn-setting-mobile').classList.remove('view-hidden'); // Tombol Setting HP Atas
      navigate('admin-dashboard'); 
    } else {
      document.getElementById('menu-user').classList.remove('view-hidden'); // Sidebar Laptop
      document.getElementById('nav-bottom-user').classList.remove('view-hidden'); // Nav Bawah HP
      navigate('user-dashboard'); 
    }
  }
  

  // --- FUNGSI LAPORAN ---
  function cetakLaporan() {
    // Fungsi sederhana untuk mencetak area tabel usulan
    window.print();
  }

  // ================= FITUR USULAN (USER) =================
  // --- FUNGSI BUKA-TUTUP (ACCORDION) DATA DASAR PEGAWAI ---
  function toggleAccordionDataDasar() {
    const content = document.getElementById('accord-data-dasar');
    const icon = document.getElementById('icon-accord-data-dasar');

    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      icon.classList.remove('rotate-180'); // Putar panah kembali
    } else {
      content.classList.add('hidden');
      icon.classList.add('rotate-180'); // Putar panah ke bawah
    }
  }
  
  // --- FUNGSI MUNCULKAN FORM DINAMIS (KEBAL ERROR) ---
  function ubahFormDinamis() {
    const jenis = document.getElementById('input-jenis-usulan').value;
    const areas = ['area-form-kgb', 'area-form-pangkat', 'area-form-keluarga', 'area-form-jabatan'];
    areas.forEach(id => { if(document.getElementById(id)) document.getElementById(id).classList.add('hidden'); });
    
    // Matikan Required
    const allDynamicFields = [
      'form-kgb-sk', 'form-kgb-tmt', 'form-kgb-gaji-lama', 'form-kgb-gaji-baru',
      'form-pkt-sk', 'form-pkt-gol-lama', 'form-pkt-gol-baru', 'form-pkt-jenis', 'form-pkt-tmt', 'form-pkt-gaji-lama', 'form-pkt-gaji-baru',
      'form-kel-status-lama', 'form-kel-status-baru',
      'form-jab-sk', 'form-jab-tmt', 'form-jab-lama', 'form-jab-baru', 'form-jab-tunj'
    ];
    allDynamicFields.forEach(id => { let el = document.getElementById(id); if(el) el.removeAttribute('required'); });

    // Hidupkan sesuai jenis
    if (jenis === 'Kenaikan Gaji Berkala (KGB)') {
      document.getElementById('area-form-kgb').classList.remove('hidden');
      ['form-kgb-sk', 'form-kgb-tmt', 'form-kgb-gaji-lama', 'form-kgb-gaji-baru'].forEach(id => document.getElementById(id).setAttribute('required', 'true'));
    } else if (jenis === 'Kenaikan Pangkat') {
      document.getElementById('area-form-pangkat').classList.remove('hidden');
      ['form-pkt-sk', 'form-pkt-gol-lama', 'form-pkt-gol-baru', 'form-pkt-jenis', 'form-pkt-tmt', 'form-pkt-gaji-lama', 'form-pkt-gaji-baru'].forEach(id => document.getElementById(id).setAttribute('required', 'true'));
    } else if (jenis === 'Perubahan Tunjangan Keluarga') {
      document.getElementById('area-form-keluarga').classList.remove('hidden');
      ['form-kel-status-lama', 'form-kel-status-baru'].forEach(id => document.getElementById(id).setAttribute('required', 'true'));
    } else if (jenis === 'Perubahan Jabatan') {
      document.getElementById('area-form-jabatan').classList.remove('hidden');
      ['form-jab-sk', 'form-jab-tmt', 'form-jab-lama', 'form-jab-baru', 'form-jab-tunj'].forEach(id => document.getElementById(id).setAttribute('required', 'true'));
    }
  }


  function ubahHalUsulan(arah) {
    const maxPage = Math.ceil(usulanFilteredList.length / limit);
    if(halUsulan + arah > 0 && halUsulan + arah <= maxPage) { halUsulan += arah; renderTabelUsulan(); }
  }

  

  // --- FUNGSI PREVIEW LAPORAN (DENGAN FILTER STATUS ASN) ---
  function previewLaporan() {
    const bulan = document.getElementById('filter-lap-bulan').value;
    const tahun = document.getElementById('filter-lap-tahun').value;
    const stat = document.getElementById('filter-lap-status').value;

    laporanFilteredList = allUsulanAdminList.filter(item => {
      if (item.status !== 'Disetujui') return false;
      
      // 1. Cek Kesesuaian TMT Bulan & Tahun
      let matchTmt = false;
      let match = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
      if (match && match[2] === bulan && match[3] === tahun) {
        matchTmt = true;
      }
      if (!matchTmt) return false;

      // 2. Cek Kesesuaian Status (PNS / PPPK)
      if (stat !== 'Semua') {
        let detail = {}; 
        try { detail = JSON.parse(item.detail); } catch(e){}
        
        // Cerdik: Cek dari Golongan Usulan (Jika ada kata 'Golongan', maka dia PPPK)
        let golongan = detail.golongan_usulan || "";
        let isPPPK = golongan.includes("Golongan");
        let itemStatus = isPPPK ? "PPPK" : "PNS";
        
        if (itemStatus !== stat) return false;
      }

      return true;
    });

    halLaporan = 1; 
    renderTabelLaporan();
  }

  function ubahHalLaporan(arah) {
    const maxPage = Math.ceil(laporanFilteredList.length / limit);
    if(halLaporan + arah > 0 && halLaporan + arah <= maxPage) { halLaporan += arah; renderTabelLaporan(); }
  }

  function renderTabelLaporan() {
    const tbody = document.getElementById('table-laporan-body'); tbody.innerHTML = '';
    const start = (halLaporan - 1) * limit; const end = start + limit;
    const paginatedData = laporanFilteredList.slice(start, end);

    if(paginatedData.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Tidak ada data untuk bulan/tahun ini.</td></tr>'; document.getElementById('info-page-laporan').innerText = "Menampilkan 0 data"; return; }
    
    paginatedData.forEach(item => {
      let tmtMatch = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
      let tmtBaru = tmtMatch ? `${tmtMatch[1]}-${tmtMatch[2]}-${tmtMatch[3]}` : '-';

      tbody.innerHTML += `
        <tr class="border-b hover:bg-gray-50 bg-white">
          <td class="p-3 text-xs align-top">${item.tanggal}<br>${item.id}</td>
          <td class="p-3 align-top font-bold text-sm">${item.nama}<br><span class="font-normal text-xs text-gray-500">NIP: ${item.nip}</span></td>
          <td class="p-3 align-top text-sm">${item.jenis}</td>
          <td class="p-3 align-top text-center font-bold text-green-700 bg-green-50">${tmtBaru}</td>
        </tr>
      `;
    });
    document.getElementById('info-page-laporan').innerText = `Menampilkan ${start + 1} - ${Math.min(end, laporanFilteredList.length)} dari ${laporanFilteredList.length} data laporan`;
    document.getElementById('num-page-laporan').innerText = halLaporan;
  }

 
  function closeModalDetail() {
    document.getElementById('modal-detail').classList.add('view-hidden');
  }

  // Hapus kode renderTabelUsulan, bukaModalDetail, hapusUsulanAdmin, prosesStatusUsulan, dan kirimStatusKeServer yang lama, lalu ganti:

function renderTabelUsulan() {
    const tbody = document.getElementById('table-admin-usulan-body'); tbody.innerHTML = '';
    const start = (halUsulan - 1) * limit; const end = start + limit;
    const paginatedData = usulanFilteredList.slice(start, end);

    if(paginatedData.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Data kosong.</td></tr>'; document.getElementById('info-page-usulan').innerText = "Menampilkan 0 data"; return; }
    
    paginatedData.forEach(item => {
      let badge = item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : (item.status === 'Disetujui' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800');
      
      let tmtBaru = `<span class="text-gray-400 italic">Belum Ditetapkan</span>`;
      let tmtMatch = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
      if(tmtMatch) tmtBaru = `<span class="font-bold text-blue-700">${tmtMatch[1]}-${tmtMatch[2]}-${tmtMatch[3]}</span>`;

      // KODE BERUBAH DI SINI: Kita menggunakan '${item.id}'
      let actionBtns = `<div class="flex justify-center gap-2">
        <button onclick="bukaModalDetail('${item.id}')" class="bg-blue-500 text-white px-3 py-1 rounded text-xs shadow"><i class="fa-solid fa-eye"></i> Lihat</button>
        <button onclick="hapusUsulanAdmin('${item.id}')" class="bg-gray-500 text-white px-3 py-1 rounded text-xs shadow"><i class="fa-solid fa-trash"></i> Hapus</button>
      </div>`;

      tbody.innerHTML += `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3 text-xs align-top">${item.tanggal}<br><span class="text-gray-400 font-mono">${item.id}</span></td>
          <td class="p-3 align-top"><span class="font-bold block text-sm text-gray-800">${item.nama}</span><span class="text-xs text-gray-500">NIP: ${item.nip}</span></td>
          <td class="p-3 align-top text-sm font-semibold text-gray-700">${item.jenis}</td>
          <td class="p-3 align-top text-center bg-yellow-50 border-l border-r border-yellow-100">${tmtBaru}</td>
          <td class="p-3 align-top text-center"><span class="px-2 py-1 rounded text-xs font-bold ${badge}">${item.status}</span></td>
          <td class="p-3 align-top text-center">${actionBtns}</td>
        </tr>
      `;
    });
    document.getElementById('info-page-usulan').innerText = `Menampilkan ${start + 1} - ${Math.min(end, usulanFilteredList.length)} dari ${usulanFilteredList.length} usulan`;
    document.getElementById('num-page-usulan').innerText = halUsulan;
}

function bukaModalDetail(idUsulan) {
    const item = allUsulanAdminList.find(x => x.id === idUsulan);
    if (!item) return;

    let detailObj = {};
    try { detailObj = JSON.parse(item.detail); } catch(e) { detailObj = {}; }
    
    document.getElementById('detail-pegawai-area').innerHTML = `
      <p class="text-sm"><span class="text-gray-500 w-20 inline-block">NIP</span>: <b class="text-gray-800">${item.nip}</b></p>
      <p class="text-sm"><span class="text-gray-500 w-20 inline-block">Nama</span>: <b class="text-gray-800">${item.nama}</b></p>
      <p class="text-sm"><span class="text-gray-500 w-20 inline-block">Golongan</span>: <b class="text-blue-700">${detailObj.golongan_usulan || "-"}</b></p>
      <p class="text-sm"><span class="text-gray-500 w-20 inline-block">Jabatan</span>: <b class="text-gray-800">${detailObj.jabatan_usulan || "-"}</b></p>
      <p class="text-sm"><span class="text-gray-500 w-20 inline-block">Unit Kerja</span>: <b class="text-gray-800">${detailObj.unit_usulan || "-"}</b></p>
    `;

    document.getElementById('detail-judul-jenis').innerText = "Rincian: " + item.jenis;
    let usulHtml = "";
    if (item.jenis === 'Kenaikan Gaji Berkala (KGB)') {
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">No SK & TMT</span> <b class="text-gray-800">${detailObj.no_sk || "-"} (TMT: ${detailObj.tmt || "-"})</b></p>`;
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Gaji LAMA <i class="fa-solid fa-arrow-right mx-1 text-gray-400"></i> BARU</span> <b class="text-gray-500 line-through">Rp ${detailObj.gaji_lama || "-"}</b> <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-green-600 text-lg">Rp ${detailObj.gaji_baru || "-"}</b></p>`;
    } else if (item.jenis === 'Kenaikan Pangkat') {
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">SK & Jenis</span> <b class="text-gray-800">${detailObj.no_sk_pangkat || "-"} (${detailObj.jenis_sk || "-"})</b></p>`;
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Gol. LAMA <i class="fa-solid fa-arrow-right mx-1 text-gray-400"></i> BARU & TMT</span> <b class="text-gray-500 line-through">${detailObj.golongan_lama || "-"}</b> <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-purple-600">${detailObj.golongan_baru || "-"} (TMT: ${detailObj.tmt_pangkat || "-"})</b></p>`;
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Gaji LAMA <i class="fa-solid fa-arrow-right mx-1 text-gray-400"></i> BARU</span> <b class="text-gray-500 line-through">Rp ${detailObj.gaji_lama || "-"}</b> <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-green-600 text-lg">Rp ${detailObj.gaji_baru || "-"}</b></p>`;
    } else if (item.jenis === 'Perubahan Jabatan') {
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">No SK & TMT</span> <b class="text-gray-800">${detailObj.no_sk_jabatan || "-"} (TMT: ${detailObj.tmt_jabatan || "-"})</b></p>`;
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Jabatan LAMA <i class="fa-solid fa-arrow-right mx-1 text-gray-400"></i> BARU</span> <b class="text-gray-500 line-through">${detailObj.jabatan_lama || "-"}</b> <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-blue-600">${detailObj.jabatan_baru || "-"}</b></p>`;
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Tunjangan Jabatan</span> <b class="text-green-600 text-lg">Rp ${detailObj.tunjangan_jabatan || "-"}</b></p>`;
    } else if (item.jenis === 'Perubahan Tunjangan Keluarga') {
      usulHtml += `<p class="text-sm border-b border-gray-100 pb-1 mb-1"><span class="text-gray-500 block text-xs">Status LAMA <i class="fa-solid fa-arrow-right mx-1 text-gray-400"></i> BARU</span> <b class="text-gray-500 line-through">${detailObj.status_lama || "-"}</b> <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-pink-600 text-lg">${detailObj.status_baru || "-"}</b></p>`;
    }
    
    usulHtml += `<div class="bg-gray-100 p-3 rounded mt-3"><p class="text-xs text-gray-500 font-bold mb-1">Catatan/Keterangan Pegawai:</p><p class="text-sm text-gray-700 italic">${detailObj.keterangan || "Tidak ada keterangan tambahan."}</p></div>`;
    document.getElementById('detail-usulan-area').innerHTML = usulHtml;

    let fileHtml = "";
    try {
      let filesArr = JSON.parse(item.fileUrl); 
      if (Array.isArray(filesArr) && filesArr.length > 0) {
        filesArr.forEach((f, idx) => {
          fileHtml += `<a href="${f.url}" target="_blank" class="flex items-center gap-3 bg-red-50 hover:bg-red-100 border border-red-200 p-2 rounded transition group">
            <i class="fa-solid fa-file-pdf text-red-500 text-xl group-hover:scale-110 transition"></i>
            <span class="text-sm text-red-800 font-semibold w-full truncate">${idx+1}. ${f.label}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-red-400 text-xs"></i>
          </a>`;
        });
      } else throw "not_array";
    } catch(e) {
      if(item.fileUrl && item.fileUrl.includes("http")) {
        fileHtml = `<a href="${item.fileUrl}" target="_blank" class="flex items-center gap-3 bg-red-50 hover:bg-red-100 border border-red-200 p-3 rounded transition"><i class="fa-solid fa-file-pdf text-red-500 text-xl"></i><span class="text-sm text-red-800 font-semibold w-full truncate">Lihat Berkas Pendukung</span></a>`;
      } else {
        fileHtml = `<p class="text-sm text-gray-500 italic">Tidak ada berkas terlampir / Gagal memuat tautan.</p>`;
      }
    }
    document.getElementById('detail-berkas-area').innerHTML = fileHtml;


    let actionArea = document.getElementById('detail-action-area');
    
    // Hapus dulu kotak edit TMT jika ada dari klik sebelumnya agar tidak ganda
    let oldEditBox = document.getElementById('box-edit-tmt');
    if (oldEditBox) oldEditBox.remove();

    if (item.status === 'Pending') {
      actionArea.innerHTML = `
        <button onclick="closeModalDetail()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded font-bold hover:bg-gray-400">Tutup</button>
        <button onclick="prosesStatusUsulan('${item.id}', 'Ditolak'); closeModalDetail()" class="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600 shadow"><i class="fa-solid fa-xmark"></i> Tolak Usulan</button>
        <button onclick="prosesStatusUsulan('${item.id}', 'Disetujui'); closeModalDetail()" class="bg-green-500 text-white px-6 py-2 rounded font-bold hover:bg-green-600 shadow"><i class="fa-solid fa-check"></i> Terima Usulan</button>
      `;
    } 
    else if (item.status === 'Disetujui') {
      // 1. Ekstrak Tanggal TMT dari Database
      let tmtMatch = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
      let tmtValueForm = "";
      if (tmtMatch) {
         // Input date butuh format YYYY-MM-DD
         tmtValueForm = `${tmtMatch[3]}-${tmtMatch[2]}-${tmtMatch[1]}`;
      }

      // 2. Tambahkan Kotak Input Edit TMT di bawah daftar file PDF
      let htmlEditTmt = `
        <div id="box-edit-tmt" class="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
           <label class="block text-xs font-bold text-yellow-800 mb-1 uppercase"><i class="fa-solid fa-calendar-day"></i> TMT Gaji Baru (Ditetapkan)</label>
           <input type="date" id="input-edit-tmt" class="w-full border p-2 rounded bg-gray-100 text-gray-500 font-bold transition outline-none" value="${tmtValueForm}" readonly>
           <input type="hidden" id="input-catatan-lama" value="${item.catatan}">
           <p class="text-[10px] text-gray-400 mt-1 italic">*Klik Buka Kunci di bawah untuk mengedit TMT.</p>
        </div>
      `;
      document.getElementById('detail-berkas-area').insertAdjacentHTML('afterend', htmlEditTmt);

      // 3. Tambahkan Tombol Buka Kunci (Gembok)
      actionArea.innerHTML = `
        <button onclick="closeModalDetail()" class="bg-gray-300 text-gray-700 px-6 py-2 rounded font-bold hover:bg-gray-400 shadow">Tutup</button>
        <button id="btn-gembok-tmt" onclick="toggleKunciTMT('${item.id}')" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow flex items-center gap-2">
          <i class="fa-solid fa-lock"></i> Buka Kunci
        </button>
      `;
    } 
    else {
      // Jika statusnya Ditolak
      actionArea.innerHTML = `<button onclick="closeModalDetail()" class="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow">Tutup</button>`;
    }

    document.getElementById('modal-detail').classList.remove('view-hidden');
}

// --- FUNGSI GEMBOK (EDIT TMT SETELAH DISETUJUI) ---
  function toggleKunciTMT(idUsulan) {
    const inputTmt = document.getElementById('input-edit-tmt');
    const btnGembok = document.getElementById('btn-gembok-tmt');
    const isTerkunci = inputTmt.readOnly;

    if (isTerkunci) {
      // PROSES MEMBUKA KUNCI: Jadikan bisa diedit
      inputTmt.readOnly = false;
      inputTmt.classList.remove('bg-gray-100', 'text-gray-500');
      inputTmt.classList.add('bg-white', 'text-blue-700', 'border-blue-400', 'ring-2', 'ring-blue-200');
      
      btnGembok.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan & Kunci';
      btnGembok.classList.replace('bg-blue-600', 'bg-green-600');
      btnGembok.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
    } else {
      // PROSES MENGUNCI & MENYIMPAN
      if(!inputTmt.value) return Swal.fire('Gagal', 'TMT tidak boleh kosong saat disimpan!', 'warning');

      // 1. Ubah format YYYY-MM-DD kembali jadi DD-MM-YYYY
      let d = new Date(inputTmt.value);
      let tmtBaruFormat = ("0"+d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + d.getFullYear();

      // 2. Ganti tulisan TMT di catatan lama dengan TMT yang baru
      let catatanLama = document.getElementById('input-catatan-lama').value;
      let catatanBaru = catatanLama.replace(/TMT Gaji Baru:\s*\d{2}-\d{2}-\d{4}/, `TMT Gaji Baru: ${tmtBaruFormat}`);

      // 3. Ubah visual jadi terkunci lagi
      inputTmt.readOnly = true;
      inputTmt.classList.add('bg-gray-100', 'text-gray-500');
      inputTmt.classList.remove('bg-white', 'text-blue-700', 'border-blue-400', 'ring-2', 'ring-blue-200');
      
      btnGembok.innerHTML = '<i class="fa-solid fa-lock"></i> Buka Kunci';
      btnGembok.classList.replace('bg-green-600', 'bg-blue-600');
      btnGembok.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');

      // 4. Kirim pembaruan diam-diam ke Database Server
      // Catatan: Karena kita panggil fungsi kirimStatusKeServer, ini juga akan otomatis menutup Modal dan Refresh Data setelah sukses.
      kirimStatusKeServer(idUsulan, 'Disetujui', catatanBaru);
    }
  }



function prosesStatusUsulan(idUsulan, statusBaru) {
    if (statusBaru === 'Disetujui') {
      Swal.fire({
        title: 'Terima Usulan',
        html: `
          <div class="text-left mt-2">
            <label class="block font-bold mb-1 text-sm text-gray-700">TMT Perubahan Gaji (Wajib)</label>
            <input type="date" id="swal-tmt" class="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-green-500" required>
            <label class="block font-bold mb-1 text-sm text-gray-700">Catatan Admin (Opsional)</label>
            <input type="text" id="swal-catatan" class="w-full border p-2 rounded focus:ring-2 focus:ring-green-500" placeholder="Misal: Sesuai aturan PMK...">
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        confirmButtonText: 'Simpan & Setujui',
        cancelButtonText: 'Batal',
        preConfirm: () => {
          const tmt = document.getElementById('swal-tmt').value;
          const cat = document.getElementById('swal-catatan').value;
          if (!tmt) { Swal.showValidationMessage('TMT Perubahan Gaji wajib diisi!'); return false; }
          
          let d = new Date(tmt);
          let tmtFormatted = ("0"+d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + d.getFullYear();
          return { tmt: tmtFormatted, catatan: cat };
        }
      }).then((result) => {
        if (result.isConfirmed) {
          let finalCatatan = "TMT Gaji Baru: " + result.value.tmt + (result.value.catatan ? " | Catatan: " + result.value.catatan : "");
          kirimStatusKeServer(idUsulan, statusBaru, finalCatatan);
        }
      });
    } else {
      Swal.fire({
        title: 'Tolak Usulan',
        input: 'text',
        inputPlaceholder: 'Tuliskan alasan penolakan...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Tolak Sekarang',
        cancelButtonText: 'Batal',
        preConfirm: (cat) => {
           if(!cat) { Swal.showValidationMessage('Alasan penolakan wajib diisi!'); return false; }
           return cat;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          kirimStatusKeServer(idUsulan, statusBaru, "Alasan Ditolak: " + result.value);
        }
      });
    }
}


  // ================= MANAJEMEN ASN (CRUD & IMPORT) =================
// ==========================================
  // LOGIC MANAJEMEN ASN (PANGKAT DINAMIS, CRUD)
  // ==========================================
  
 // Database Pangkat PNS (Format Baru Menggunakan Kurung)
  const listPangkatPNS = [
    "Juru Muda (I/a)", "Juru Muda Tk.I (I/b)", "Juru (I/c)", "Juru Tk.I (I/d)",
    "Pengatur Muda (II/a)", "Pengatur Muda Tk.I (II/b)", "Pengatur (II/c)", "Pengatur Tk.I (II/d)",
    "Penata Muda (III/a)", "Penata Muda Tk.I (III/b)", "Penata (III/c)", "Penata Tk.I (III/d)",
    "Pembina (IV/a)", "Pembina Tk.I (IV/b)", "Pembina Utama Muda (IV/c)", "Pembina Utama Madya (IV/d)", "Pembina Utama (IV/e)"
  ];
  
  // Database PPPK (Tetap)
  const listPangkatPPPK = [
    "Golongan I", "Golongan II", "Golongan III", "Golongan IV", "Golongan V", "Golongan VI", "Golongan VII", "Golongan VIII", "Golongan IX", 
    "Golongan X", "Golongan XI", "Golongan XII", "Golongan XIII", "Golongan XIV", "Golongan XV", "Golongan XVI", "Golongan XVII"
  ];

  // Fungsi Merubah Dropdown Golongan otomatis saat Status berubah
  function renderDropdownGolongan(selectedValue = "") {
    const status = document.getElementById('asn-status').value;
    const selectGol = document.getElementById('asn-golongan');
    
    selectGol.innerHTML = '<option value="">-- Pilih Pangkat/Golongan --</option>';
    
    if (status === "PNS") {
      selectGol.disabled = false;
      listPangkatPNS.forEach(gol => {
        let selected = (gol === selectedValue) ? "selected" : "";
        selectGol.innerHTML += `<option value="${gol}" ${selected}>${gol}</option>`;
      });
    } else if (status === "PPPK") {
      selectGol.disabled = false;
      listPangkatPPPK.forEach(gol => {
        let selected = (gol === selectedValue) ? "selected" : "";
        selectGol.innerHTML += `<option value="${gol}" ${selected}>${gol}</option>`;
      });
    } else {
      selectGol.disabled = true;
      selectGol.innerHTML = '<option value="">-- Pilih Status Terlebih Dahulu --</option>';
    }
  }


  // --- FUNGSI FILTER PEGAWAI (3 KONDISI SEKALIGUS) ---
  function filterTabelASN() {
    const src = document.getElementById('search-asn').value.toLowerCase();
    const stat = document.getElementById('filter-asn-status').value;
    const unit = document.getElementById('filter-asn-unit').value;

    asnFilteredList = asnDataList.filter(i => {
      let matchSearch = i.nip.toString().includes(src) || i.nama.toLowerCase().includes(src);
      let matchStat = (stat === 'Semua') ? true : (i.status === stat);
      let matchUnit = (unit === 'Semua') ? true : (i.unit === unit);
      
      return matchSearch && matchStat && matchUnit;
    });
    
    halPegawai = 1; 
    renderTabelASN();
  }

  function ubahHalPegawai(arah) {
    const maxPage = Math.ceil(asnFilteredList.length / limit);
    if(halPegawai + arah > 0 && halPegawai + arah <= maxPage) { halPegawai += arah; renderTabelASN(); }
  }



  function bukaModalASN() { 
    document.getElementById('form-asn').reset(); 
    document.getElementById('asn-rowidx').value = ""; 
    document.getElementById('modal-asn-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> Tambah Data Pegawai';
    renderDropdownGolongan(); // Reset dropdown golongan
    document.getElementById('modal-asn').classList.remove('view-hidden'); 
  }
  
  function closeModalASN() { document.getElementById('modal-asn').classList.add('view-hidden'); }
  

function renderTabelASN() {
    const tbody = document.getElementById('table-asn-body'); tbody.innerHTML = '';
    const start = (halPegawai - 1) * limit; const end = start + limit;
    const paginatedData = asnFilteredList.slice(start, end);
    
    if(paginatedData.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Data kosong.</td></tr>'; document.getElementById('info-page-pegawai').innerText = "Menampilkan 0 data"; return;}
    
    paginatedData.forEach(item => {
      let badge = item.status === 'PNS' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 border-b">
          <td class="p-3 align-top"><span class="font-bold block">${item.nama}</span><span class="text-xs text-gray-500">NIP: ${item.nip}</span></td>
          <td class="p-3 text-sm align-top"><span class="font-bold text-gray-700">${item.jabatan}</span><br><span class="text-xs text-purple-600">${item.golongan}</span></td>
          <td class="p-3 text-sm align-top">${item.unit}<br><span class="text-xs font-bold text-green-600"><i class="fa-solid fa-location-dot"></i> ${item.kabkota}</span></td>
          <td class="p-3 align-top"><span class="px-2 py-1 rounded text-xs font-bold ${badge}">${item.status}</span></td>
          <td class="p-3 text-center space-x-1 align-top">
            <button onclick='bukaEditASN(${JSON.stringify(item)})' class="bg-yellow-500 text-white px-2 py-2 rounded text-xs shadow"><i class="fa-solid fa-pen"></i></button>
            <button onclick="hapusDataASN('${item.nip}')" class="bg-red-500 text-white px-2 py-2 rounded text-xs shadow"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    });
    document.getElementById('info-page-pegawai').innerText = `Menampilkan ${start + 1} - ${Math.min(end, asnFilteredList.length)} dari ${asnFilteredList.length} data`;
    document.getElementById('num-page-pegawai').innerText = halPegawai;
}

function bukaEditASN(item) {
    // Kita simpan NIP lama di input hidden sebagai penanda pencarian
    document.getElementById('asn-rowidx').value = item.nip; 
    document.getElementById('asn-nip').value = item.nip; 
    document.getElementById('asn-nama').value = item.nama;
    document.getElementById('asn-password').value = ""; 
    document.getElementById('asn-jabatan').value = item.jabatan; 
    document.getElementById('asn-unit').value = item.unit;
    document.getElementById('asn-kabkota').value = item.kabkota;
    document.getElementById('asn-status').value = item.status; 
    
    renderDropdownGolongan(item.golongan);
    let dbEmail = item.email && item.email !== "-" ? item.email : "";
    if(document.getElementById('asn-email')) document.getElementById('asn-email').value = dbEmail;
    
    document.getElementById('modal-asn-title').innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit Data Pegawai';
    document.getElementById('modal-asn').classList.remove('view-hidden');
}


  // ==========================================
  // LOGIC VALIDASI NIP 18 DIGIT & AUTO-PASS
  // ==========================================
  function validasiNIP(input) {
    // Memaksa hanya input angka
    input.value = input.value.replace(/[^0-9]/g, '');

    // Memaksa tidak bisa diketik lebih dari 18 digit
    if (input.value.length > 18) {
      Swal.fire({ icon: 'warning', title: 'Batas NIP', text: 'NIP maksimal 18 digit!', timer: 1500, showConfirmButton: false });
      input.value = input.value.slice(0, 18);
    }
    
    // Otomatis menempelkan NIP sebagai Password pada Form Tambah Pegawai
    if (input.id === 'asn-nip') {
       document.getElementById('asn-password').value = input.value;
    }
  }

  function cekPanjangNIP(input) {
    // Saat kursor pindah ke kolom lain, cek apakah kurang dari 18
    if (input.value.length > 0 && input.value.length < 18) {
      Swal.fire({ icon: 'error', title: 'NIP Tidak Valid', text: `NIP harus tepat 18 digit angka! Anda baru mengetik ${input.value.length} digit.` });
    }
  }

  // ==========================================
  // LOGIC POPUP IMPORT & TEMPLATE EXCEL
  // ==========================================
  function bukaModalImport() {
    document.getElementById('upload-excel-modal').value = '';
    document.getElementById('modal-import-asn').classList.remove('view-hidden');
  }
  
  function closeModalImport() {
    document.getElementById('modal-import-asn').classList.add('view-hidden');
  }

  function unduhTemplateExcel() {
    // 1. Template Tanpa Kolom Password (Karna Pass = NIP)
    let aoa = [
      ['NIP', 'Nama Lengkap', 'Jabatan', 'Golongan', 'Unit Kerja', 'Kab_Kota', 'Status (PNS/PPPK)'],
      ['199001012015021001', 'Budi Santoso', 'Guru Ahli Pertama', 'Penata Muda / III.a', 'SMAN 1 Kota Jambi', 'Kota Jambi', 'PNS'],
      ['198512122008012002', 'Siti Aminah', 'Guru Madya', 'Pembina / IV.a', 'SMKN 1 Merangin', 'Kabupaten Merangin', 'PPPK']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch: 22}, {wch: 30}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Pegawai");
    XLSX.writeFile(wb, "Template_Import_Pegawai.xlsx");
  }

  // ==========================================
  // LOGIC IMPORT EXCEL (SMART DATA CLEANING)
  // ==========================================

  // --- FUNGSI FORMAT RUPIAH OTOMATIS SAAT DIKETIK ---
  function formatRupiah(angka) {
    let number_string = angka.value.replace(/[^,\d]/g, '').toString(),
        split = number_string.split(','),
        sisa  = split[0].length % 3,
        rupiah  = split[0].substr(0, sisa),
        ribuan  = split[0].substr(sisa).match(/\d{3}/gi);

    if(ribuan){
      let separator = sisa ? '.' : '';
      rupiah += separator + ribuan.join('.');
    }
    angka.value = rupiah;
  }

  // --- DROPDOWN GOLONGAN KHUSUS MENU PROFIL ---
  function renderDropdownGolonganUser(status, selectedValue = "") {
    const selectGol = document.getElementById('prof-golongan');
    selectGol.innerHTML = '<option value="">-- Pilih Pangkat/Golongan --</option>';
    let listArr = (status === "PNS") ? listPangkatPNS : listPangkatPPPK;
    listArr.forEach(gol => {
      let selected = (gol === selectedValue) ? "selected" : "";
      selectGol.innerHTML += `<option value="${gol}" ${selected}>${gol}</option>`;
    });
  }


async function unduhLaporanExcel() {
    if (laporanFilteredList.length === 0) return Swal.fire('Data Kosong', `Tidak ada usulan untuk didownload pada bulan dan tahun ini.`, 'info');

    // Menyiapkan Variabel Dasar
    const bulan = document.getElementById('filter-lap-bulan').value;
    const tahun = document.getElementById('filter-lap-tahun').value;
    const dinas = document.getElementById('set-nama').value || "DINAS PENDIDIKAN PROVINSI JAMBI";
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const namaBulan = monthNames[parseInt(bulan) - 1];

    // Mengambil Data Tanda Tangan dari Pengaturan
    const kNama = document.getElementById('set-ttd-kepala-nama')?.value || "NAMA KEPALA DINAS";
    const kPangkat = document.getElementById('set-ttd-kepala-pangkat')?.value || "Pembina Utama Madya (IV/d)";
    const kNip = document.getElementById('set-ttd-kepala-nip')?.value || "NIP. 19700101 200001 1 001";
    const bNama = document.getElementById('set-ttd-bendahara-nama')?.value || "NAMA BENDAHARA";
    const bPangkat = document.getElementById('set-ttd-bendahara-pangkat')?.value || "Penata Tk.I (III/d)";
    const bNip = document.getElementById('set-ttd-bendahara-nip')?.value || "NIP. 19800101 201001 2 001";

    showLoading(true);

    try {
        // 1. Inisialisasi Workbook ExcelJS
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Laporan Mutasi');

        // 2. Mengatur Lebar Kolom (A sampai H)
        sheet.columns = [
            { width: 6 },  // A: NO
            { width: 35 }, // B: NAMA / NIP
            { width: 28 }, // C: PANGKAT / GOLONGAN
            { width: 25 }, // D: JENIS
            { width: 20 }, // E: DATA LAMA
            { width: 20 }, // F: DATA BARU
            { width: 18 }, // G: TMT
            { width: 35 }  // H: KETERANGAN
        ];

        // 3. Menambahkan Judul Laporan (Center & Bold)
        sheet.mergeCells('A1:H1');
        sheet.getCell('A1').value = 'DAFTAR FORMULIR PEREMAJAAN DATA MUTASI GAJI PEGAWAI (Pangkat/Berkala)';
        sheet.mergeCells('A2:H2');
        sheet.getCell('A2').value = dinas.toUpperCase();
        sheet.mergeCells('A3:H3');
        sheet.getCell('A3').value = `BULAN ${namaBulan.toUpperCase()} TAHUN ${tahun}`;

        for(let i = 1; i <= 3; i++) {
            sheet.getCell(`A${i}`).alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell(`A${i}`).font = { bold: true, size: 12 };
        }

        // 4. Membuat Header Tabel (Baris 5 & 6)
        sheet.mergeCells('A5:A6'); sheet.getCell('A5').value = 'NO.';
        sheet.mergeCells('B5:B6'); sheet.getCell('B5').value = 'NAMA / NIP';
        sheet.mergeCells('C5:C6'); sheet.getCell('C5').value = 'PANGKAT / GOLONGAN';
        sheet.mergeCells('D5:D6'); sheet.getCell('D5').value = 'JENIS';
        
        sheet.mergeCells('E5:F5'); sheet.getCell('E5').value = 'DATA MUTASI';
        sheet.getCell('E6').value = 'LAMA';
        sheet.getCell('F6').value = 'BARU';
        
        sheet.mergeCells('G5:G6'); sheet.getCell('G5').value = 'TMT';
        sheet.mergeCells('H5:H6'); sheet.getCell('H5').value = 'KETERANGAN';

        // Menambahkan Baris Angka (Indeks Kolom) di Baris ke-7
        sheet.addRow([1, 2, 3, 4, 5, 6, 7, 8]);

        // Fungsi bantuan untuk memformat angka menjadi format Rupiah dengan titik
        const formatRp = (angka) => {
            if (!angka || isNaN(angka)) return '-';
            return 'Rp ' + new Intl.NumberFormat('id-ID').format(angka);
        };

        // 5. Memasukkan Data Pegawai
        laporanFilteredList.forEach((item, index) => {
            let detail = {}; try { detail = JSON.parse(item.detail); } catch(e) {}
            
            let namaNip = `${item.nama}\nNip. ${item.nip}`;
            let pangkat = detail.golongan_usulan || '-';
            let jenis = item.jenis;
            
            let tmtMatch = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
            let tmtText = tmtMatch ? `${tmtMatch[1]} ${monthNames[parseInt(tmtMatch[2])-1]} ${tmtMatch[3]}` : '-';

            let lamaText = '-', baruText = '-', tmtSk = '';
            
            // PENERAPAN FORMAT RUPIAH DI SINI
            if (jenis === 'Kenaikan Gaji Berkala (KGB)') {
                lamaText = `${formatRp(detail.gaji_lama)}`; 
                baruText = `${formatRp(detail.gaji_baru)}`; 
                tmtSk = detail.tmt || '-';
            } else if (jenis === 'Kenaikan Pangkat') {
                lamaText = `${detail.golongan_lama || '-'}\n${formatRp(detail.gaji_lama)}`; 
                baruText = `${detail.golongan_baru || '-'}\n${formatRp(detail.gaji_baru)}`; 
                tmtSk = detail.tmt_pangkat || '-'; 
                jenis = "Kenaikan Pangkat\nKenaikan Gapok";
            } else if (jenis === 'Perubahan Jabatan') {
                lamaText = `${detail.jabatan_lama || '-'}`; 
                baruText = `${detail.jabatan_baru || '-'}\n${formatRp(detail.tunjangan_jabatan)}`; 
                tmtSk = detail.tmt_jabatan || '-';
            }
            let ket = `${detail.unit_usulan || '-'}\n(TMT SK ${tmtSk})`;
            
            sheet.addRow([ index + 1, namaNip, pangkat, jenis, lamaText, baruText, tmtText, ket ]);
        });

        let endRowData = sheet.lastRow.number;

        // 6. Memberikan Garis Pembatas (Borders) dan Teks Rapi (Wrap Text)
        for (let i = 5; i <= endRowData; i++) {
            let row = sheet.getRow(i);
            row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                // Menambahkan Garis
                cell.border = {
                    top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
                };
                
                if (i <= 7) {
                    // Gaya untuk Header Tabel (Bold & Tengah)
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                } else {
                    // Gaya untuk Isi Data (Kiri atas, kecuali Nomor dan TMT di Tengah)
                    cell.alignment = { 
                        horizontal: (colNumber === 1 || colNumber === 7) ? 'center' : 'left', 
                        vertical: 'top', 
                        wrapText: true 
                    };
                }
            });
        }

        // 7. Membuat Area Tanda Tangan (Kepala Dinas Kiri, Bendahara Kanan)
        let ttdStartRow = endRowData + 2;
        
        // Tanggal Laporan di Kanan
        sheet.getCell(`G${ttdStartRow}`).value = `Jambi, .................... ${tahun}`;
        
        // Jabatan
        sheet.getCell(`B${ttdStartRow + 1}`).value = 'Kepala Dinas Pendidikan';
        sheet.getCell(`G${ttdStartRow + 1}`).value = 'Bendahara Pengeluaran';
        
        sheet.getCell(`B${ttdStartRow + 2}`).value = 'Provinsi Jambi';
        
        // Nama Lengkap (Berada 4 baris di bawah jabatan untuk ruang tanda tangan)
        sheet.getCell(`B${ttdStartRow + 6}`).value = kNama;
        sheet.getCell(`G${ttdStartRow + 6}`).value = bNama;
        
        // Pangkat
        sheet.getCell(`B${ttdStartRow + 7}`).value = kPangkat;
        sheet.getCell(`G${ttdStartRow + 7}`).value = bPangkat;
        
        // NIP
        sheet.getCell(`B${ttdStartRow + 8}`).value = kNip;
        sheet.getCell(`G${ttdStartRow + 8}`).value = bNip;

        // Mengatur Posisi Tanda Tangan agar berada di Tengah (Center)
        for(let r = ttdStartRow; r <= ttdStartRow + 8; r++) {
            sheet.getCell(`B${r}`).alignment = { horizontal: 'center' };
            sheet.getCell(`G${r}`).alignment = { horizontal: 'center' };
        }
        
        // Menebalkan dan Menggarisbawahi Nama Kepala & Bendahara
        sheet.getCell(`B${ttdStartRow + 6}`).font = { bold: true, underline: true };
        sheet.getCell(`G${ttdStartRow + 6}`).font = { bold: true, underline: true };

        // 8. Menyimpan dan Mengunduh File Excel
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Mutasi_Gaji_${namaBulan}_${tahun}.xlsx`);
        
        showLoading(false);
    } catch (error) {
        showLoading(false);
        console.error("Error Cetak Excel:", error);
        Swal.fire('Gagal Mencetak', 'Terjadi kesalahan saat memproses laporan.', 'error');
    }
}


  // --- FUNGSI MULTIPLE UPLOAD BERKAS ---
  function inisiasiFormUpload() {
    document.getElementById('container-file-upload').innerHTML = "";
    fileCount = 0;
    tambahBarisFile(); // Selalu beri 1 baris kosong di awal
  }

  function tambahBarisFile() {
    if (fileCount >= 3) return Swal.fire('Batas Maksimal', 'Anda hanya diizinkan melampirkan maksimal 3 berkas per usulan.', 'warning');
    fileCount++;
    const id = 'file-row-' + Date.now();
    const html = `
      <div id="${id}" class="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-3 border rounded shadow-sm">
        <div class="flex-grow w-full">
          <input type="text" class="file-label w-full border border-gray-300 p-2 rounded text-sm mb-2 focus:ring-2 focus:ring-blue-500" placeholder="Ketik Nama Berkas (Misal: SK Pangkat Terakhir)" required>
          <input type="file" class="file-input w-full border border-gray-300 p-1 rounded text-sm bg-gray-50" accept=".pdf" required>
        </div>
        <button type="button" onclick="hapusBarisFile('${id}')" class="bg-gray-200 text-red-600 px-3 py-2 rounded hover:bg-gray-300 transition w-full md:w-auto" title="Hapus Baris Ini"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    document.getElementById('container-file-upload').insertAdjacentHTML('beforeend', html);
  }

  function hapusBarisFile(id) {
    if (fileCount <= 1) return Swal.fire('Peringatan', 'Minimal harus melampirkan 1 berkas!', 'warning');
    document.getElementById(id).remove();
    fileCount--;
  }

  // Fungsi pengubah file ke teks base64 tanpa nge-lag (Asynchronous)
  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // --- FUNGSI MATA PASSWORD UNIVERSAL ---
  function togglePasswordInput(inputId, iconId) {
    const passInput = document.getElementById(inputId);
    const eyeIcon = document.getElementById(iconId);
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      passInput.type = 'password';
      eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  }


// --- FUNGSI NAVIGASI LANDING & LOGIN ---
  function bukaHalamanLogin() {
    document.getElementById('view-landing').classList.add('view-hidden');
    document.getElementById('view-login').classList.remove('view-hidden');
  }

  function kembaliKeLanding() {
    document.getElementById('view-login').classList.add('view-hidden');
    document.getElementById('view-landing').classList.remove('view-hidden');
  }

  // --- FUNGSI LUPA PASSWORD VIA EMAIL ---
  function lupaPassword() {
    document.getElementById('modal-lupa-pass').classList.remove('view-hidden');
  }

  function closeModalLupaPass() {
    document.getElementById('modal-lupa-pass').classList.add('view-hidden');
  }

// ==========================================
  // LOGIC POPUP KEBIJAKAN PRIVASI
  // ==========================================
  function bukaModalPrivasi() {
    document.getElementById('modal-privasi').classList.remove('view-hidden');
  }
  
  function closeModalPrivasi() {
    document.getElementById('modal-privasi').classList.add('view-hidden');
  }

// --- FUNGSI MEMUNCULKAN MENU DI HP (MOBILE RESPONSIVE) ---
  function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  }

  // --- FUNGSI BUKA/TUTUP POPUP TAMBAHAN DI LOGIN ---
  function bukaModalInstall() { document.getElementById('modal-install').classList.remove('view-hidden'); }
  function closeModalInstall() { document.getElementById('modal-install').classList.add('view-hidden'); }

  function bukaModalKontak() { document.getElementById('modal-kontak').classList.remove('view-hidden'); }
  function closeModalKontak() { document.getElementById('modal-kontak').classList.add('view-hidden'); }

  // --- FUNGSI FILTER KHUSUS KELOLA USULAN ADMIN ---
  function filterTabelUsulan() {
    const fStatusUsulan = document.getElementById('filter-usulan-status').value;
    const fStatusAsn = document.getElementById('filter-usulan-asn').value;
    const fBulan = document.getElementById('filter-usulan-bulan').value;

    usulanFilteredList = allUsulanAdminList.filter(item => {
      // 1. Filter Status Usulan (Pending/Disetujui/Ditolak)
      if (fStatusUsulan !== 'Semua' && item.status !== fStatusUsulan) return false;

      // 2. Filter Status Kepegawaian (PNS / PPPK)
      let detail = {}; 
      try { detail = JSON.parse(item.detail); } catch(e){}
      let golongan = detail.golongan_usulan || "";
      let isPPPK = golongan.includes("Golongan"); // PPPK biasanya memakai kata "Golongan I, II, dst"
      let itemAsn = isPPPK ? "PPPK" : "PNS";
      
      if (fStatusAsn !== 'Semua' && itemAsn !== fStatusAsn) return false;

      // 3. Filter Bulan TMT Gaji Baru
      if (fBulan !== 'Semua') {
        let match = item.catatan.match(/TMT Gaji Baru:\s*(\d{2})-(\d{2})-(\d{4})/);
        // Jika admin filter bulan, tapi data belum ada TMT-nya (karena masih Pending), maka akan disembunyikan.
        if (!match || match[2] !== fBulan) return false; 
      }

      return true; // Lulus semua saringan filter
    });

    halUsulan = 1; // Kembalikan ke halaman 1
    renderTabelUsulan(); // Refresh tampilan tabelnya
  }

  // --- FUNGSI MENGGAMBAR GRAFIK DASHBOARD ADMIN ---
  let grafikStatus = null;
  let grafikJenis = null;

  function renderGrafikAdmin() {
    // 1. Menghitung Data dari allUsulanAdminList
    let countPending = 0, countSetuju = 0, countTolak = 0;
    let hitungJenis = {};

    allUsulanAdminList.forEach(item => {
      // Hitung Status
      if(item.status === 'Pending') countPending++;
      else if(item.status === 'Disetujui') countSetuju++;
      else if(item.status === 'Ditolak') countTolak++;

      // Hitung Jenis (Otomatis menambah kategori jika ada yang baru)
      let jenis = item.jenis || "Tidak Diketahui";
      hitungJenis[jenis] = (hitungJenis[jenis] || 0) + 1;
    });

    // 2. Hancurkan Grafik Lama Jika Ada (Agar tidak menumpuk saat direload)
    if(grafikStatus) grafikStatus.destroy();
    if(grafikJenis) grafikJenis.destroy();

    // 3. Menggambar Grafik Donat (Status)
    const ctxStatus = document.getElementById('chartStatusUsulan');
    if (ctxStatus) {
      grafikStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Disetujui', 'Ditolak'],
          datasets: [{
            data: [countPending, countSetuju, countTolak],
            backgroundColor: ['#eab308', '#22c55e', '#ef4444'], // Kuning, Hijau, Merah
            borderWidth: 2
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // 4. Menggambar Grafik Batang (Jenis Usulan)
    const ctxJenis = document.getElementById('chartJenisUsulan');
    if (ctxJenis) {
      grafikJenis = new Chart(ctxJenis, {
        type: 'bar',
        data: {
          labels: Object.keys(hitungJenis),
          datasets: [{
            label: 'Total Usulan',
            data: Object.values(hitungJenis),
            backgroundColor: '#3b82f6', // Biru Tailwind
            borderRadius: 6
          }]
        },
        options: { 
          responsive: true, maintainAspectRatio: false, 
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }
  }
