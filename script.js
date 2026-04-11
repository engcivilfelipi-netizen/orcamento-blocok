// ==========================================
// 🔒 INICIALIZAÇÃO E VARIÁVEIS
// ==========================================
let db, auth;
let franquiaAtiva = { id: "MATRIZ", nome: "MATRIZ", cor: "#ff6b00", precos: {}, descontoMax: 5 };
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

// ==========================================
// 🛂 MONITOR DE ACESSO (VÍNCULO COM A MATRIZ)
// ==========================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Busca qual franquia esse e-mail pertence (Coleção 'usuarios')
        const userDoc = await db.collection("usuarios").doc(user.email).get();
        let idF = userDoc.exists ? userDoc.data().franquiaID : "MATRIZ";
        
        // Busca os dados da Unidade (Coleção 'configuracoes')
        const configDoc = await db.collection("configuracoes").doc(idF).get();
        if (configDoc.exists) {
            franquiaAtiva = { id: idF, ...configDoc.data() };
            // Aplica a cor e o nome dinamicamente
            document.documentElement.style.setProperty('--primary-color', franquiaAtiva.cor);
            document.getElementById('nomeFranquia').innerText = franquiaAtiva.nome;
        }

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('infoLogado').innerText = `Unidade: ${user.email}`;
        
        // Libera painel se for o administrador
        if (user.email === 'felipelimagomez@gmail.com' || user.email === 'admin@blocok.com') {
            document.getElementById('painelAdmin').style.display = 'block';
        }
        
        atualizarSelectProjetos();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value;
    try { await auth.signInWithEmailAndPassword(email, pass); } 
    catch (e) { document.getElementById('loginError').style.display = 'block'; }
};

document.getElementById('btnLogout').onclick = () => auth.signOut();

// ==========================================
// 📐 MOTOR DE MEDIÇÃO
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
    document.getElementById('statusBar').innerText = "Planta carregada. Clique em Calibrar.";
};

document.getElementById('btnCalibrar').onclick = () => { estadoAtual = 'calibrando_p1'; document.getElementById('statusBar').innerText = "Clique no ponto inicial da escala."; };
document.getElementById('btnMedir').onclick = () => { estadoAtual = 'medindo_p1'; document.getElementById('statusBar').innerText = "Clique no início da parede."; };

canvas.onclick = (e) => {
    const x = e.offsetX, y = e.offsetY;
    if (estadoAtual === 'calibrando_p1') { ponto1 = {x,y}; estadoAtual = 'calibrando_p2'; }
    else if (estadoAtual === 'calibrando_p2') {
        let r = prompt("Qual a medida real dessa linha (em metros)?");
        if(r) {
            pixelsPorMetro = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / parseFloat(r.replace(',','.'));
            document.getElementById('btnMedir').disabled = false;
            estadoAtual = 'ocioso';
            document.getElementById('statusBar').innerText = "Calibrado com sucesso!";
        }
    }
    else if (estadoAtual === 'medindo_p1') { ponto1 = {x,y}; estadoAtual = 'medindo_p2'; }
    else if (estadoAtual === 'medindo_p2') {
        let m = Math.sqrt(Math.pow(x-ponto1.x,2)+Math.pow(y-ponto1.y,2)) / pixelsPorMetro;
        paredesMedidas.push({ comp: m, esp: document.getElementById('espessuraCorrente').value });
        renderizarTabela();
        estadoAtual = 'ocioso';
    }
};

function renderizarTabela() {
    const t = document.getElementById('corpoTabela'); t.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        t.innerHTML += `<tr><td>${i+1}</td><td>${p.comp.toFixed(2)}m</td><td>${p.esp}cm</td><td><button class="btn-tech-danger" onclick="removerP(${i})">X</button></td></tr>`;
    });
}
window.removerP = (i) => { paredesMedidas.splice(i, 1); renderizarTabela(); };

document.getElementById('btnAdicionarManual').onclick = () => {
    let m = parseFloat(document.getElementById('comprimentoManual').value);
    if(m > 0) { paredesMedidas.push({ comp: m, esp: document.getElementById('espessuraCorrente').value }); renderizarTabela(); }
};

// ==========================================
// 🚀 GERAÇÃO DE PDF PROFISSIONAL (ANTI-ERRO)
// ==========================================
document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    if(paredesMedidas.length === 0) return alert("Meça as paredes primeiro.");

    let nome = document.getElementById('nomeProjetoAtivo').value || "CLIENTE";
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    
    let totalM2 = 0; let rows = '';
    paredesMedidas.forEach(p => {
        let m2 = p.comp * h; totalM2 += m2;
        let precoUn = (franquiaAtiva.precos[p.esp] && franquiaAtiva.precos[p.esp][pag]) ? franquiaAtiva.precos[p.esp][pag] : 0;
        rows += `<tr><td>Painel ${p.esp}cm</td><td>${p.comp.toFixed(2)}m</td><td>${m2.toFixed(2)}m²</td><td>R$ ${precoUn.toFixed(2)}</td></tr>`;
    });

    const caixa = document.getElementById('caixaResultado');
    caixa.innerHTML = `
        <button id="btnBaixarPdf" class="btn-tech-run" style="margin-bottom:15px;">📄 BAIXAR PROPOSTA AGORA</button>
        <div id="pdfWrapper" style="background:#cbd5e1; padding:20px; overflow-x:auto; border-radius:8px;">
            <div id="pdfContent">
                <div style="display:flex; justify-content:space-between; border-bottom:4px solid ${franquiaAtiva.cor}; padding-bottom:10px;">
                    <div><h1 style="margin:0;">ORÇAMENTO</h1><p>Cliente: ${nome.toUpperCase()}</p></div>
                    <div style="text-align:right;"><h2 style="color:${franquiaAtiva.cor}; margin:0;">${franquiaAtiva.nome}</h2></div>
                </div>
                <table class="pdf-table">
                    <thead><tr><th>Descrição</th><th>Comprimento</th><th>Área Total</th><th>Preço Unit.</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="margin-top:20px; padding:15px; background:#f8fafc; border-left:5px solid ${franquiaAtiva.cor};">
                    <h3 style="margin:0;">Resumo da Obra</h3>
                    <p>Área Total Estimada: <strong>${totalM2.toFixed(2)} m²</strong></p>
                </div>
                <p style="text-align:center; font-size:10px; margin-top:50px; color:#64748b;">Documento gerado digitalmente pela Unidade: ${franquiaAtiva.nome}</p>
            </div>
        </div>
    `;
    caixa.style.display = 'block';

    document.getElementById('btnBaixarPdf').onclick = () => {
        const btn = document.getElementById('btnBaixarPdf');
        btn.innerText = "⏳ PROCESSANDO...";
        window.scrollTo(0,0);
        
        const opt = {
            margin: 10,
            filename: `Proposta_${nome}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 1000 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(document.getElementById('pdfContent')).save().then(() => {
            btn.innerText = "📄 BAIXAR PROPOSTA AGORA";
        });
    };
};

// ==========================================
// ☁️ GESTÃO DE DADOS NA NUVEM
// ==========================================
async function atualizarSelectProjetos() {
    const snap = await db.collection("obras").where("franquiaID", "==", franquiaAtiva.id).get();
    const select = document.getElementById('selectProjetos');
    select.innerHTML = '<option value="">-- Suas Obras --</option>';
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.id}">${doc.id.split('_')[1]}</option>`; });
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    const nome = document.getElementById('nomeProjetoAtivo').value;
    if(!nome) return alert("Dê um nome à obra.");
    await db.collection("obras").doc(`${franquiaAtiva.id}_${nome}`).set({
        paredes: paredesMedidas,
        franquiaID: franquiaAtiva.id,
        vendedor: auth.currentUser.email,
        data: new Date().toISOString()
    });
    alert("Obra sincronizada com a nuvem!");
    atualizarSelectProjetos();
};

document.getElementById('btnCarregarProjeto').onclick = async () => {
    const id = document.getElementById('selectProjetos').value;
    if(!id) return alert("Selecione.");
    const doc = await db.collection("obras").doc(id).get();
    if(doc.exists) { 
        paredesMedidas = doc.data().paredes; 
        renderizarTabela(); 
        alert("Obra carregada!"); 
    }
};

document.getElementById('btnExcluirProjeto').onclick = async () => {
    const id = document.getElementById('selectProjetos').value;
    if(id && confirm("Deseja apagar esta obra permanentemente?")) { 
        await db.collection("obras").doc(id).delete(); 
        atualizarSelectProjetos(); 
    }
};

document.getElementById('btnLimpar').onclick = () => { if(confirm("Limpar medições atuais?")) { paredesMedidas = []; renderizarTabela(); } };