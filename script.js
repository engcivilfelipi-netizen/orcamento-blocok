// ==========================================
// 🔒 INICIALIZAÇÃO FIREBASE
// ==========================================
let db, auth;
let precosBlocok = { "10":{avista:100,prazo:110}, "15":{avista:120,prazo:130}, descontoMaximo: 5 };
let configVisualNuvem = { logo: null, cor: "#ff6b00", tamanho: 70 };
let paredesMedidas = [];
let pixelsPorMetro = 0;
let estadoAtual = 'ocioso';
let ponto1 = null;
let imagemPlanta = new Image();

const firebaseConfig = {
    apiKey: "AIzaSyD_-PVu4YFerz9n9Zeh2dxxdssRjyOmTZA",
    authDomain: "blocok-os.firebaseapp.com",
    projectId: "blocok-os",
    storageBucket: "blocok-os.firebasestorage.app",
    messagingSenderId: "1017522769680",
    appId: "1:1017522769680:web:5612e95fd71fc1dd361f95"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
db = firebase.firestore();
auth = firebase.auth();

const canvas = document.getElementById('areaDesenho');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('statusBar');

// ==========================================
// 🛂 MONITOR DE LOGIN E RESTRICÕES
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('infoLogado').innerText = `Conectado: ${user.email}`;
        
        const isAdmin = (user.email === 'admin@blocok.com');
        document.getElementById('painelAdmin').style.display = isAdmin ? 'block' : 'none';
        
        if(!isAdmin) {
            ['precoArgamassa', 'precoPU', 'custoConvPronto', 'custoBlocokMO', 'produtividadeDiaria'].forEach(id => {
                let el = document.getElementById(id); if(el) { el.disabled = true; el.style.backgroundColor = "#1e293b"; }
            });
        }
        
        carregarPrecosDaNuvem();
        carregarIdentidadeVisualDaNuvem();
        atualizarSelectProjetos();
        carregarEstadoLocal();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }
});

document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value;
    try { await auth.signInWithEmailAndPassword(email, pass); } 
    catch (e) { alert("Acesso negado."); }
};
document.getElementById('btnLogout').onclick = () => auth.signOut();

// ==========================================
// ⚙️ GESTÃO DE NUVEM
// ==========================================
async function carregarPrecosDaNuvem() {
    const doc = await db.collection("configuracoes").doc("precosGlobais").get();
    if (doc.exists) {
        precosBlocok = doc.data();
        if(auth.currentUser.email === 'admin@blocok.com') {
            document.getElementById('p10v').value = precosBlocok["10"].avista;
            document.getElementById('p15v').value = precosBlocok["15"].avista;
            document.getElementById('descontoMax').value = precosBlocok.descontoMaximo || 5;
        }
    }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    const novos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value), prazo: parseFloat(document.getElementById('p10v').value * 1.1) },
        "15": { avista: parseFloat(document.getElementById('p15v').value), prazo: parseFloat(document.getElementById('p15v').value * 1.1) },
        "descontoMaximo": parseFloat(document.getElementById('descontoMax').value)
    };
    await db.collection("configuracoes").doc("precosGlobais").set(novos);
    precosBlocok = novos; alert("Configurações de Preço Salvas!");
};

async function carregarIdentidadeVisualDaNuvem() {
    const doc = await db.collection("configuracoes").doc("identidadeVisual").get();
    if (doc.exists) configVisualNuvem = doc.data();
}

document.getElementById('uploadLogoEmpresa').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvasBox = document.createElement('canvas');
            const maxW = 400; const scale = img.width > maxW ? maxW / img.width : 1;
            canvasBox.width = img.width * scale; canvasBox.height = img.height * scale;
            canvasBox.getContext('2d').drawImage(img, 0, 0, canvasBox.width, canvasBox.height);
            configVisualNuvem.logo = canvasBox.toDataURL('image/jpeg', 0.8);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
};

document.getElementById('btnSalvarVisuais').onclick = async () => {
    configVisualNuvem.cor = document.getElementById('inputCorDestaque').value;
    await db.collection("configuracoes").doc("identidadeVisual").set(configVisualNuvem);
    alert("Identidade Visual Atualizada!");
};

// ==========================================
// 📐 MEDIÇÃO E DESENHO
// ==========================================
document.getElementById('uploadPlanta').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { imagemPlanta.src = ev.target.result; };
    reader.readAsDataURL(e.target.files[0]);
};
imagemPlanta.onload = () => {
    canvas.width = imagemPlanta.width; canvas.height = imagemPlanta.height;
    ctx.drawImage(imagemPlanta, 0, 0);
    document.getElementById('btnCalibrar').disabled = false;
    statusBar.innerText = "Planta carregada. Clique em Calibrar.";
};

document.getElementById('btnCalibrar').onclick = () => { estadoAtual = 'calibrando_p1'; statusBar.innerText = "Clique no PONTO 1."; };
document.getElementById('btnMedir').onclick = () => { estadoAtual = 'medindo_p1'; statusBar.innerText = "Clique INÍCIO da parede."; };

canvas.onclick = (e) => {
    const x = e.offsetX, y = e.offsetY;
    if (estadoAtual === 'calibrando_p1') { ponto1 = {x,y}; estadoAtual = 'calibrando_p2'; }
    else if (estadoAtual === 'calibrando_p2') {
        let real = prompt("Quantos metros reais tem essa linha?");
        if(real) {
            pixelsPorMetro = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / parseFloat(real.replace(',','.'));
            document.getElementById('btnMedir').disabled = false; estadoAtual = 'ocioso'; statusBar.innerText = "Calibrado!";
        }
    }
    else if (estadoAtual === 'medindo_p1') { ponto1 = {x,y}; estadoAtual = 'medindo_p2'; }
    else if (estadoAtual === 'medindo_p2') {
        let m = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / pixelsPorMetro;
        paredesMedidas.push({ comp: m, esp: document.getElementById('espessuraCorrente').value });
        renderizarTabela(); estadoAtual = 'ocioso';
    }
};

document.getElementById('btnAdicionarManual').onclick = () => {
    let m = parseFloat(document.getElementById('comprimentoManual').value);
    if(m > 0) { paredesMedidas.push({ comp: m, esp: document.getElementById('espessuraCorrente').value }); renderizarTabela(); }
};

function renderizarTabela() {
    const t = document.getElementById('corpoTabela'); t.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        t.innerHTML += `<tr><td>${i+1}</td><td>${p.comp.toFixed(2)}m</td><td>${p.esp}cm</td><td><button onclick="removerP(${i})">X</button></td></tr>`;
    });
}
window.removerP = (i) => { paredesMedidas.splice(i, 1); renderizarTabela(); };

// ==========================================
// 🚀 GERAÇÃO DE PROPOSTA E ROMANEIO
// ==========================================
document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    if(paredesMedidas.length === 0) return alert("Nenhuma parede medida.");

    const isAdmin = (auth.currentUser.email === 'admin@blocok.com');
    let descPct = parseFloat(document.getElementById('valorDesconto').value || 0);
    if (!isAdmin && descPct > precosBlocok.descontoMaximo) {
        alert(`❌ Erro: O desconto máximo permitido é de ${precosBlocok.descontoMaximo}%!`);
        document.getElementById('valorDesconto').value = precosBlocok.descontoMaximo;
        descPct = precosBlocok.descontoMaximo;
    }

    let nome = document.getElementById('nomeProjetoAtivo').value || "CLIENTE";
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    let cor = configVisualNuvem.cor;
    let frete = parseFloat(document.getElementById('valorFrete').value || 0);

    let totalM2 = 0; let resumo = {};
    paredesMedidas.forEach(p => { 
        let m2 = p.comp * h; totalM2 += m2; 
        if(!resumo[p.esp]) resumo[p.esp] = 0; resumo[p.esp] += m2; 
    });

    // --- PDF PROPOSTA ---
    let htmlPdf = `
    <div id="pdfContent" style="padding: 30px; font-family: Arial; background: white; color: black; min-height: 800px;">
        <table style="width:100%; border:none;"><tr><td style="border:none;"></td><td style="text-align:right; border:none;">
            ${configVisualNuvem.logo ? `<img src="${configVisualNuvem.logo}" style="max-height:70px;">` : ''}
        </td></tr></table>
        <div style="border-bottom: 3px solid ${cor}; margin-bottom: 20px;"><h1 style="margin:0; font-size:22px;">PROPOSTA COMERCIAL</h1><p>Obra: ${nome.toUpperCase()} | Data: ${new Date().toLocaleDateString()}</p></div>
        
        <h3 style="color:${cor}; font-size:14px;">1. Painéis Construtivos (${pag.toUpperCase()})</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
            <tr style="background:${cor}; color:white;"><th>Espessura</th><th>Área</th><th>Qtd</th><th>Subtotal</th></tr>`;

    let totalProdutos = 0;
    let romaneioRows = '';
    for(let esp in resumo) {
        let m2 = resumo[esp]; let qtd = Math.ceil(m2 / 0.81);
        let precoUnit = precosBlocok[esp] ? precosBlocok[esp][pag] : 100;
        let sub = qtd * precoUnit; totalProdutos += sub;
        htmlPdf += `<tr><td style="border:1px solid #ccc; padding:5px;">${esp} cm</td><td style="border:1px solid #ccc; padding:5px;">${m2.toFixed(2)} m²</td><td style="border:1px solid #ccc; padding:5px;">${qtd} un</td><td style="border:1px solid #ccc; padding:5px;">R$ ${sub.toLocaleString()}</td></tr>`;
        romaneioRows += `<tr><td style="border:1px solid #000; padding:5px;">Painel ${esp}cm</td><td style="border:1px solid #000; padding:5px; text-align:center;">${qtd} un</td></tr>`;
    }
    htmlPdf += `</table>`;

    if(document.getElementById('chkInsumos').checked) {
        let pArg = parseFloat(document.getElementById('precoArgamassa').value);
        let sacos = Math.ceil(totalM2 / 10);
        let valInsumo = sacos * pArg; totalProdutos += valInsumo;
        htmlPdf += `<h3 style="color:${cor}; font-size:14px;">2. Materiais de Instalação</h3>
        <p style="font-size:11px;">Itens básicos para montagem de ${totalM2.toFixed(2)}m².</p>
        <table style="width:100%; font-size:12px;"><tr><td>Argamassa: ${sacos} sacos</td><td>R$ ${valInsumo.toLocaleString()}</td></tr></table>`;
    }

    let valDesc = totalProdutos * (descPct/100);
    let totalFinal = totalProdutos - valDesc + frete;

    htmlPdf += `
        <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:8px; font-size:14px;">
            <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><b>R$ ${totalProdutos.toLocaleString()}</b></div>
            ${descPct > 0 ? `<div style="display:flex; justify-content:space-between; color:red;"><span>Desconto (${descPct}%):</span><b>- R$ ${valDesc.toLocaleString()}</b></div>` : ''}
            ${frete > 0 ? `<div style="display:flex; justify-content:space-between; color:blue;"><span>Frete:</span><b>+ R$ ${frete.toLocaleString()}</b></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:18px; margin-top:10px; border-top:2px solid #ccc; padding-top:10px;">
                <strong>TOTAL:</strong><strong style="color:${cor};">R$ ${totalFinal.toLocaleString()}</strong>
            </div>
        </div>`;

    if(document.getElementById('chkCronograma').checked) {
        let dias = Math.ceil(totalM2 / parseFloat(document.getElementById('produtividadeDiaria').value));
        htmlPdf += `<div style="margin-top:20px; padding:10px; border-left:5px solid ${cor}; background:#f0f0f0;">
            <b>Prazo Estimado:</b> ${dias} dia(s) útil(eis) para montagem das paredes.
        </div>`;
    }

    if(document.getElementById('chkComparativo').checked) {
        let conv = totalM2 * parseFloat(document.getElementById('custoConvPronto').value);
        let seu = totalFinal + (totalM2 * parseFloat(document.getElementById('custoBlocokMO').value));
        let econo = conv - seu;
        htmlPdf += `<h3 style="color:${cor}; margin-top:20px;">Análise de Viabilidade</h3>
        <p style="font-size:12px;">Convencional: R$ ${conv.toLocaleString()} | <b>Seu Sistema: R$ ${seu.toLocaleString()}</b></p>
        <div style="background:#e8f5e9; padding:10px; color:#2e7d32; font-weight:bold;">Economia Gerada: R$ ${econo.toLocaleString()}</div>`;
    }

    htmlPdf += `<p style="font-size:10px; text-align:center; margin-top:30px;">* Proposta gerada via BLOCOK OS.</p></div>`;

    // --- ROMANEIO ---
    let htmlRomaneio = `<div id="pdfRomaneio" style="padding:40px; background:white; color:black;">
        <h2 style="text-align:center; border-bottom:2px solid #000;">ROMANEIO DE CARGA</h2>
        <p>Obra: ${nome.toUpperCase()} | Data: ${new Date().toLocaleDateString()}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:20px;">
            <tr style="background:#ddd;"><th>Item</th><th>Quantidade</th></tr>
            ${romaneioRows}
        </table>
        <div style="margin-top:50px; text-align:center;"><p>_________________________</p><p>Assinatura Conferente</p></div>
    </div>`;

    const caixa = document.getElementById('caixaResultado');
    caixa.innerHTML = htmlPdf + `<div style="display:flex; gap:10px; margin-top:20px;">
        <button id="btnPdf" style="flex:1; padding:15px; background:${cor}; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📄 BAIXAR PROPOSTA</button>
        <button id="btnRom" style="flex:1; padding:15px; background:#475569; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">🏭 ROMANEIO</button>
    </div>` + `<div id="hiddenRom" style="display:none;">${htmlRomaneio}</div>`;
    caixa.style.display = 'block';

    document.getElementById('btnPdf').onclick = () => html2pdf().set({margin:0, filename:`Proposta_${nome}.pdf`, html2canvas:{scale:2}, jsPDF:{format:'a4'}}).from(document.getElementById('pdfContent')).save();
    document.getElementById('btnRom').onclick = () => html2pdf().set({margin:0, filename:`Romaneio_${nome}.pdf`, html2canvas:{scale:2}, jsPDF:{format:'a4'}}).from(document.getElementById('pdfRomaneio')).save();
};

// ==========================================
// ☁️ GERENCIAMENTO E FILTROS
// ==========================================
async function atualizarSelectProjetos() {
    const user = auth.currentUser;
    const snap = (user.email === 'admin@blocok.com') ? await db.collection("obras").get() : await db.collection("obras").where("dono", "==", user.email).get();
    const select = document.getElementById('selectProjetos');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.id}">${doc.id}</option>`; });
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    const nome = document.getElementById('nomeProjetoAtivo').value;
    if(!nome) return alert("Dê um nome à obra.");
    await db.collection("obras").doc(nome).set({ paredes: paredesMedidas, dono: auth.currentUser.email, data: new Date().toISOString() });
    alert("Obra na Nuvem!"); atualizarSelectProjetos();
};

document.getElementById('btnCarregarProjeto').onclick = async () => {
    const nome = document.getElementById('selectProjetos').value;
    const doc = await db.collection("obras").doc(nome).get();
    if(doc.exists) { paredesMedidas = doc.data().paredes; renderizarTabela(); alert("Obra Carregada!"); }
};

function carregarEstadoLocal() { /* Função para carregar rascunhos do navegador */ }