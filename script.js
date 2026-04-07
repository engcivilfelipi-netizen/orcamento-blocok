// ==========================================
// 🔒 INICIALIZAÇÃO E SEGURANÇA
// ==========================================
let db, auth;
let precosBlocok = { "10":{avista:0,prazo:0}, "13":{avista:0,prazo:0}, "15":{avista:0,prazo:0}, "20":{avista:0,prazo:0} };
let configVisualNuvem = { logo: null, tamanho: 70, cor: "#ff6b00" };
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

// MONITOR DE SESSÃO
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('infoLogado').innerText = `Conectado: ${user.email}`;
        aplicarRestricoes(user.email);
        carregarPrecosDaNuvem();
        carregarIdentidadeVisualDaNuvem();
        atualizarSelectProjetos();
        carregarEstadoLocal();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }
});

function aplicarRestricoes(email) {
    const isAdmin = (email === 'admin@blocok.com');
    document.getElementById('painelAdmin').style.display = isAdmin ? 'block' : 'none';
    if (!isAdmin) {
        const bloqueados = ['precoArgamassa', 'precoPU', 'precoTela', 'custoConvPronto', 'custoBlocokMO', 'produtividadeDiaria'];
        bloqueados.forEach(id => {
            let el = document.getElementById(id);
            if(el) { el.disabled = true; el.style.backgroundColor = "#1e293b"; }
        });
    }
}

// LOGIN E LOGOUT
document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value;
    const btn = document.getElementById('btnLogin');
    btn.innerText = "⏳ VALIDANDO..."; btn.disabled = true;
    try { await auth.signInWithEmailAndPassword(email, pass); } 
    catch (e) { alert("Erro: e-mail ou senha incorretos."); btn.innerText = "AUTENTICAR NO SERVIDOR"; btn.disabled = false; }
};
document.getElementById('btnLogout').onclick = () => auth.signOut();

// ==========================================
// 🎨 GESTÃO VISUAL E COMPRESSÃO
// ==========================================
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
    alert("Visual salvo!");
};

// ==========================================
// ⚙️ PREÇOS E NUVEM
// ==========================================
async function carregarPrecosDaNuvem() {
    const doc = await db.collection("configuracoes").doc("precosGlobais").get();
    if (doc.exists) {
        precosBlocok = doc.data();
        if(auth.currentUser.email === 'admin@blocok.com') {
            document.getElementById('p10v').value = precosBlocok["10"].avista; document.getElementById('p10p').value = precosBlocok["10"].prazo;
            document.getElementById('p15v').value = precosBlocok["15"].avista; document.getElementById('p15p').value = precosBlocok["15"].prazo;
            document.getElementById('descontoMax').value = precosBlocok.descontoMaximo || 5;
        }
    }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    const novos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value), prazo: parseFloat(document.getElementById('p10p').value) },
        "13": { avista: 113, prazo: 120 },
        "15": { avista: parseFloat(document.getElementById('p15v').value), prazo: parseFloat(document.getElementById('p15p').value) },
        "20": { avista: 134, prazo: 141 },
        "descontoMaximo": parseFloat(document.getElementById('descontoMax').value)
    };
    await db.collection("configuracoes").doc("precosGlobais").set(novos);
    alert("Tabela atualizada!");
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
    statusBar.innerText = "Planta carregada.";
};

document.getElementById('btnCalibrar').onclick = () => { estadoAtual = 'calibrando_p1'; statusBar.innerText = "Clique no PONTO 1."; };
document.getElementById('btnMedir').onclick = () => { estadoAtual = 'medindo_p1'; statusBar.innerText = "Clique INÍCIO."; };

canvas.onclick = (e) => {
    const x = e.offsetX, y = e.offsetY;
    if (estadoAtual === 'calibrando_p1') { ponto1 = {x,y}; estadoAtual = 'calibrando_p2'; }
    else if (estadoAtual === 'calibrando_p2') {
        let real = prompt("Metros reais?");
        if(real) pixelsPorMetro = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / parseFloat(real.replace(',','.'));
        document.getElementById('btnMedir').disabled = false; estadoAtual = 'ocioso';
    }
    else if (estadoAtual === 'medindo_p1') { ponto1 = {x,y}; estadoAtual = 'medindo_p2'; }
    else if (estadoAtual === 'medindo_p2') {
        let m = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / pixelsPorMetro;
        adicionarParede(m); estadoAtual = 'ocioso';
    }
};

function adicionarParede(m) {
    paredesMedidas.push({ comp: m, esp: document.getElementById('espessuraCorrente').value });
    renderizarTabela(); salvarEstadoLocal();
}

document.getElementById('btnAdicionarManual').onclick = () => {
    let m = parseFloat(document.getElementById('comprimentoManual').value);
    if(m > 0) { adicionarParede(m); document.getElementById('comprimentoManual').value = ''; }
};

function renderizarTabela() {
    const t = document.getElementById('corpoTabela'); t.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        t.innerHTML += `<tr><td>${i+1}</td><td>${p.comp.toFixed(2)}m</td><td>${p.esp}cm</td><td><button onclick="removerP(${i})">X</button></td></tr>`;
    });
}
window.removerP = (i) => { paredesMedidas.splice(i, 1); renderizarTabela(); salvarEstadoLocal(); };

// ==========================================
// 🚀 GERAÇÃO DO PDF COMPLETO
// ==========================================
document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    if(paredesMedidas.length === 0) return alert("Meça as paredes.");

    let nome = document.getElementById('nomeProjetoAtivo').value || "Cliente";
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    let cor = configVisualNuvem.cor;
    
    let frete = parseFloat(document.getElementById('valorFrete').value || 0);
    let descPct = parseFloat(document.getElementById('valorDesconto').value || 0);
    
    // Cálculos
    let totalM2 = 0; let resumo = {};
    paredesMedidas.forEach(p => {
        totalM2 += (p.comp * h);
        if(!resumo[p.esp]) resumo[p.esp] = 0; resumo[p.esp] += (p.comp * h);
    });

    let htmlPdf = `
    <div id="pdfContent" style="padding: 30px; font-family: Arial; background: white; color: black; min-height: 800px;">
        <table style="width:100%; border:none;">
            <tr>
                <td style="border:none;"></td>
                <td style="text-align:right; border:none;">
                    ${configVisualNuvem.logo ? `<img src="${configVisualNuvem.logo}" style="max-height:70px; max-width:${configVisualNuvem.tamanho}%;">` : ''}
                </td>
            </tr>
        </table>
        <div style="border-bottom: 3px solid ${cor}; padding-bottom: 5px; margin-bottom: 20px;">
            <h1 style="margin:0; font-size:22px;">PROPOSTA COMERCIAL</h1>
            <p style="margin:0; font-size:12px;">Obra: ${nome.toUpperCase()} | Data: ${new Date().toLocaleDateString()}</p>
        </div>

        <h3 style="color:${cor}; font-size:14px;">1. Quantitativo de Painéis (${pag.toUpperCase()})</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
            <tr style="background:${cor}; color:white;"><th>Espessura</th><th>Área Real</th><th>Qtd Peças</th><th>Subtotal</th></tr>`;

    let totalProdutos = 0;
    for(let esp in resumo) {
        let m2 = resumo[esp]; let qtd = Math.ceil(m2 / 0.81);
        let valor = (precosBlocok[esp] ? precosBlocok[esp][pag] : 100) * qtd;
        totalProdutos += valor;
        htmlPdf += `<tr><td style="border:1px solid #ccc; padding:5px;">${esp} cm</td><td style="border:1px solid #ccc; padding:5px;">${m2.toFixed(2)} m²</td><td style="border:1px solid #ccc; padding:5px;">${qtd} un</td><td style="border:1px solid #ccc; padding:5px;">R$ ${valor.toLocaleString()}</td></tr>`;
    }
    htmlPdf += `</table>`;

    if(document.getElementById('chkInsumos').checked) {
        let pArg = parseFloat(document.getElementById('precoArgamassa').value);
        let sacos = Math.ceil(totalM2 / 10);
        totalProdutos += (sacos * pArg);
        htmlPdf += `<h3 style="color:${cor}; font-size:14px;">2. Materiais de Instalação</h3>
        <p style="font-size:11px;">Insumos básicos (Argamassa, PU, Telas) estimados para ${totalM2.toFixed(2)}m².</p>`;
    }

    let descontoReais = totalProdutos * (descPct/100);
    let totalGeral = totalProdutos - descontoReais + frete;

    htmlPdf += `
        <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:8px;">
            <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><b>R$ ${totalProdutos.toLocaleString()}</b></div>
            ${descPct > 0 ? `<div style="display:flex; justify-content:space-between; color:red;"><span>Desconto (${descPct}%):</span><b>- R$ ${descontoReais.toLocaleString()}</b></div>` : ''}
            ${frete > 0 ? `<div style="display:flex; justify-content:space-between; color:blue;"><span>Frete:</span><b>+ R$ ${frete.toLocaleString()}</b></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:18px; margin-top:10px; border-top:1px solid #ccc; padding-top:10px;">
                <strong>TOTAL A PAGAR:</strong><strong style="color:${cor};">R$ ${totalGeral.toLocaleString()}</strong>
            </div>
        </div>`;

    if(document.getElementById('chkCronograma').checked) {
        let dias = Math.ceil(totalM2 / parseFloat(document.getElementById('produtividadeDiaria').value));
        htmlPdf += `<h3 style="color:${cor}; margin-top:20px; font-size:14px;">3. Cronograma de Montagem</h3>
        <p style="font-size:12px;">Tempo estimado para as paredes: <b>${dias} dia(s) útil(eis)</b>.</p>`;
    }

    htmlPdf += `<p style="font-size:10px; text-align:center; margin-top:40px; color:#666;">* Documento gerado digitalmente por BLOCOK OS.</p></div>`;

    const caixa = document.getElementById('caixaResultado');
    caixa.innerHTML = htmlPdf + `<div style="display:flex; gap:10px; margin-top:15px;">
        <button id="btnPdfDown" style="flex:1; padding:12px; background:${cor}; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">📄 BAIXAR PDF</button>
        <button id="btnZap" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">💬 WHATSAPP</button>
    </div>`;
    caixa.style.display = 'block';

    document.getElementById('btnPdfDown').onclick = () => {
        html2pdf().set({ margin:0, filename:'Proposta.pdf', html2canvas:{scale:2}, jsPDF:{format:'a4'} }).from(document.getElementById('pdfContent')).save();
    };
};

// ==========================================
// ☁️ GERENCIAMENTO DE DADOS
// ==========================================
async function atualizarSelectProjetos() {
    const select = document.getElementById('selectProjetos');
    const user = auth.currentUser; if(!user) return;
    const snap = (user.email === 'admin@blocok.com') ? await db.collection("obras").get() : await db.collection("obras").where("dono", "==", user.email).get();
    select.innerHTML = '<option value="">-- Selecione --</option>';
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.id}">${doc.id}</option>`; });
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    const nome = document.getElementById('nomeProjetoAtivo').value;
    if(!nome) return alert("Dê um nome à obra.");
    await db.collection("obras").doc(nome).set({
        paredes: paredesMedidas, dono: auth.currentUser.email, data: new Date().toISOString()
    });
    alert("Salvo!"); atualizarSelectProjetos();
};

function salvarEstadoLocal() {
    localStorage.setItem('blocok_temp', JSON.stringify(paredesMedidas));
}
function carregarEstadoLocal() {
    const saved = localStorage.getItem('blocok_temp');
    if(saved) { paredesMedidas = JSON.parse(saved); renderizarTabela(); }
}