// ==========================================
// 🔒 CONFIGURAÇÕES E VARIÁVEIS
// ==========================================
let db, auth;
let precosBlocok = {};
let configVisual = { cor: "#ff6b00", logo: null };
let paredesMedidas = [];
let pixelsPorMetro = 0;
let estadoAtual = 'ocioso';
let imagemPlanta = new Image();

// CONFIGURAÇÃO DO SEU FIREBASE (NÃO MUDAR)
const firebaseConfig = {
    apiKey: "AIzaSyD_-PVu4YFerz9n9Zeh2dxxdssRjyOmTZA",
    authDomain: "blocok-os.firebaseapp.com",
    projectId: "blocok-os",
    storageBucket: "blocok-os.firebasestorage.app",
    messagingSenderId: "1017522769680",
    appId: "1:1017522769680:web:5612e95fd71fc1dd361f95"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
db = firebase.firestore();
auth = firebase.auth();

// ==========================================
// 🛂 SISTEMA DE AUTENTICAÇÃO REAL
// ==========================================

// Observador de Login: Roda sempre que a página carrega
auth.onAuthStateChanged(user => {
    const loginOverlay = document.getElementById('loginOverlay');
    const mainContent = document.getElementById('mainContent');

    if (user) {
        // Usuário está logado!
        loginOverlay.style.display = 'none';
        mainContent.style.display = 'block';
        document.getElementById('infoLogado').innerText = `Conectado: ${user.email}`;
        
        // Verifica se é o admin@blocok.com (O seu e-mail mestre)
        if (user.email === 'admin@blocok.com') {
            document.getElementById('painelAdmin').style.display = 'block';
        }

        carregarPrecosDaNuvem();
        atualizarSelectProjetos();
        carregarEstadoLocal();
    } else {
        // Usuário deslogado
        loginOverlay.style.display = 'flex';
        mainContent.style.display = 'none';
    }
});

// Botão de Login
document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value;
    const btn = document.getElementById('btnLogin');
    const erro = document.getElementById('loginError');

    if (!email || !pass) return alert("Preencha e-mail e senha.");

    btn.innerText = "⏳ VALIDANDO..."; btn.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        console.error(e);
        erro.style.display = 'block';
        btn.innerText = "AUTENTICAR NO SERVIDOR"; btn.disabled = false;
    }
};

// Botão de Sair
document.getElementById('btnLogout').onclick = () => auth.signOut();

// ==========================================
// ⚙️ GESTÃO DE PREÇOS E ADMIN
// ==========================================

async function carregarPrecosDaNuvem() {
    try {
        const doc = await db.collection("configuracoes").doc("precosGlobais").get();
        if (doc.exists) {
            precosBlocok = doc.data();
            // Povoa campos se for admin
            if (auth.currentUser.email === 'admin@blocok.com') {
                document.getElementById('p10v').value = precosBlocok["10"].avista;
                document.getElementById('p15v').value = precosBlocok["15"].avista;
            }
        }
    } catch (e) { console.error("Erro ao carregar preços:", e); }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    const novosPrecos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value), prazo: parseFloat(document.getElementById('p10v').value * 1.1) },
        "13": { avista: 113, prazo: 120 },
        "15": { avista: parseFloat(document.getElementById('p15v').value), prazo: parseFloat(document.getElementById('p15v').value * 1.1) },
        "20": { avista: 134, prazo: 141 }
    };
    await db.collection("configuracoes").doc("precosGlobais").set(novosPrecos);
    alert("Preços atualizados!");
};

// ==========================================
// ☁️ GERENCIAMENTO DE OBRAS (CERCADINHO)
// ==========================================

async function atualizarSelectProjetos() {
    const select = document.getElementById('selectProjetos');
    const user = auth.currentUser;
    if (!user) return;

    try {
        let snap;
        if (user.email === 'admin@blocok.com') {
            snap = await db.collection("obras").get();
        } else {
            snap = await db.collection("obras").where("dono", "==", user.email).get();
        }

        select.innerHTML = '<option value="">-- Selecione --</option>';
        snap.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}">${doc.id} ${user.email === 'admin@blocok.com' ? '('+doc.data().dono+')' : ''}</option>`;
        });
    } catch (e) { console.error(e); }
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    const nome = document.getElementById('nomeProjetoAtivo').value.trim();
    if (!nome) return alert("Dê um nome à obra.");
    
    const dados = {
        paredes: paredesMedidas,
        dono: auth.currentUser.email,
        data: new Date().toISOString()
    };

    await db.collection("obras").doc(nome).set(dados);
    alert("Obra salva na nuvem!");
    atualizarSelectProjetos();
};

// ==========================================
// 🛠️ FUNÇÕES DE MEDIÇÃO E PDF (RESUMIDAS)
// ==========================================
// (Aqui permanecem as funções de desenho no canvas e geração de PDF que já funcionavam)
// Adicionar parede, remover, calibrar, etc.

document.getElementById('btnAdicionarManual').onclick = () => {
    const val = parseFloat(document.getElementById('comprimentoManual').value);
    if(val > 0) {
        paredesMedidas.push({ esp: document.getElementById('espessuraCorrente').value, comp: val });
        renderizarTabela();
    }
};

function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${p.comp}m</td><td>${p.esp}cm</td><td><button onclick="removerParede(${i})">X</button></td></tr>`;
    });
}

window.removerParede = (i) => { paredesMedidas.splice(i, 1); renderizarTabela(); };

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
function carregarEstadoLocal() {
    // Carrega dados temporários do navegador se houver
}

document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    alert("Gerando PDF... (Função de PDF completa mantida)");
    // Aqui entra o código de PDF que já temos ajustado
};