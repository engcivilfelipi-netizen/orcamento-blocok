// ==========================================
// 🔒 VARIÁVEIS GLOBAIS DE SISTEMA
// ==========================================
let precosBlocok = {
    "10": { avista: 0, prazo: 0 }, "13": { avista: 0, prazo: 0 }, "15": { avista: 0, prazo: 0 }, "20": { avista: 0, prazo: 0 }
};

let configVisualNuvem = { logo: null, tamanho: 70, cor: "#ff6b00" }; 
let listaUsuariosGlobais = {}; 

let paredesMedidas = []; 
let imagemPlanta = new Image();
let pixelsPorMetro = 0;
let estadoAtual = 'ocioso';
let ponto1 = null;

const canvas = document.getElementById('areaDesenho');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('statusBar');

// ==========================================
// ☁️ CONEXÃO COM O GOOGLE FIREBASE
// ==========================================
let db = null;
try {
    if (typeof firebase !== 'undefined') {
        const firebaseConfig = {
            apiKey: "AIzaSyD_-PVu4YFerz9n9Zeh2dxxdssRjyOmTZA",
            authDomain: "blocok-os.firebaseapp.com",
            projectId: "blocok-os",
            storageBucket: "blocok-os.firebasestorage.app",
            messagingSenderId: "1017522769680",
            appId: "1:1017522769680:web:5612e95fd71fc1dd361f95"
        };
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        db = firebase.firestore();
    }
} catch (erro) { console.error("Erro Nuvem:", erro); }

// ==========================================
// ⚙️ GESTÃO DE PREÇOS E ADMIN (NA NUVEM)
// ==========================================
async function carregarPrecosDaNuvem() {
    if (!db) return;
    try {
        const docRef = await db.collection("configuracoes").doc("precosGlobais").get();
        if (docRef.exists) { precosBlocok = docRef.data(); } 
        else {
            precosBlocok = {
                "10": { avista: 103.52, prazo: 109.07 }, "13": { avista: 113.03, prazo: 118.98 },
                "15": { avista: 120.74, prazo: 127.09 }, "20": { avista: 134.13, prazo: 141.19 },
                "descontoMaximo": 5
            };
            await db.collection("configuracoes").doc("precosGlobais").set(precosBlocok);
        }
        document.getElementById('p10v').value = precosBlocok["10"].avista; document.getElementById('p10p').value = precosBlocok["10"].prazo;
        document.getElementById('p13v').value = precosBlocok["13"].avista; document.getElementById('p13p').value = precosBlocok["13"].prazo;
        document.getElementById('p15v').value = precosBlocok["15"].avista; document.getElementById('p15p').value = precosBlocok["15"].prazo;
        document.getElementById('p20v').value = precosBlocok["20"].avista; document.getElementById('p20p').value = precosBlocok["20"].prazo;
        
        const carregarSeExistir = (id, chave) => { if(precosBlocok[chave] !== undefined) document.getElementById(id).value = precosBlocok[chave]; };
        carregarSeExistir('precoArgamassa', 'precoArgamassa'); carregarSeExistir('precoPU', 'precoPU'); carregarSeExistir('precoTela', 'precoTela');
        carregarSeExistir('custoConvBruto', 'custoConvBruto'); carregarSeExistir('custoConvPronto', 'custoConvPronto'); carregarSeExistir('custoBlocokMO', 'custoBlocokMO');
        carregarSeExistir('produtividadeDiaria', 'produtividadeDiaria'); carregarSeExistir('descontoMax', 'descontoMaximo');
    } catch (error) { console.error("Erro preços:", error); }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    let btn = document.getElementById('btnSalvarPrecosGlobais'); btn.innerText = "⏳ ENVIANDO..."; btn.disabled = true;
    const novosPrecos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value || 0), prazo: parseFloat(document.getElementById('p10p').value || 0) },
        "13": { avista: parseFloat(document.getElementById('p13v').value || 0), prazo: parseFloat(document.getElementById('p13p').value || 0) },
        "15": { avista: parseFloat(document.getElementById('p15v').value || 0), prazo: parseFloat(document.getElementById('p15p').value || 0) },
        "