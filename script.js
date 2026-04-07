// ==========================================
// 🔒 CONFIGURAÇÃO DE USUÁRIOS E PERFIS
// ==========================================
const USUARIOS = {
    "admin": { senha: "blocok2024", perfil: "admin" },
    "vendedor1": { senha: "vendas01", perfil: "vendedor" },
    "vendedor2": { senha: "vendas02", perfil: "vendedor" }
};

let precosBlocok = {
    "10": { avista: 0, prazo: 0 }, "13": { avista: 0, prazo: 0 }, "15": { avista: 0, prazo: 0 }, "20": { avista: 0, prazo: 0 }
};

let paredesMedidas = []; 
let imagemPlanta = new Image();
let pixelsPorMetro = 0;
let estadoAtual = 'ocioso';
let ponto1 = null;

const canvas = document.getElementById('areaDesenho');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('statusBar');

// ==========================================
// ☁️ CONEXÃO COM O GOOGLE FIREBASE (NUVEM)
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
} catch (erro) { console.error("Erro ao iniciar a Nuvem:", erro); }

// ==========================================
// ⚙️ GESTÃO DE PREÇOS NA NUVEM (ADMIN)
// ==========================================

async function carregarPrecosDaNuvem() {
    if (!db) return;
    try {
        const docRef = await db.collection("configuracoes").doc("precosGlobais").get();
        if (docRef.exists) {
            precosBlocok = docRef.data();
        } else {
            precosBlocok = {
                "10": { avista: 103.52, prazo: 109.07 }, "13": { avista: 113.03, prazo: 118.98 },
                "15": { avista: 120.74, prazo: 127.09 }, "20": { avista: 134.13, prazo: 141.19 }
            };
            await db.collection("configuracoes").doc("precosGlobais").set(precosBlocok);
        }
        
        // Povoa Blocos
        document.getElementById('p10v').value = precosBlocok["10"].avista; document.getElementById('p10p').value = precosBlocok["10"].prazo;
        document.getElementById('p13v').value = precosBlocok["13"].avista; document.getElementById('p13p').value = precosBlocok["13"].prazo;
        document.getElementById('p15v').value = precosBlocok["15"].avista; document.getElementById('p15p').value = precosBlocok["15"].prazo;
        document.getElementById('p20v').value = precosBlocok["20"].avista; document.getElementById('p20p').value = precosBlocok["20"].prazo;
        
        // Povoa Insumos, Comparativo e Produtividade se existirem na nuvem
        const carregarSeExistir = (id, chave) => { if(precosBlocok[chave] !== undefined) document.getElementById(id).value = precosBlocok[chave]; };
        carregarSeExistir('precoArgamassa', 'precoArgamassa');
        carregarSeExistir('precoPU', 'precoPU');
        carregarSeExistir('precoTela', 'precoTela');
        carregarSeExistir('custoConvBruto', 'custoConvBruto');
        carregarSeExistir('custoConvPronto', 'custoConvPronto');
        carregarSeExistir('custoBlocokMO', 'custoBlocokMO');
        carregarSeExistir('produtividadeDiaria', 'produtividadeDiaria');
        
    } catch (error) { console.error("Erro ao buscar preços:", error); }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    let btn = document.getElementById('btnSalvarPrecosGlobais');
    btn.innerText = "⏳ Atualizando Servidor..."; btn.disabled = true;

    // Agora salva TUDO (Blocos, Insumos, Comparativo e Produtividade)
    const novosPrecos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value || 0), prazo: parseFloat(document.getElementById('p10p').value || 0) },
        "13": { avista: parseFloat(document.getElementById('p13v').value || 0), prazo: parseFloat(document.getElementById('p13p').value || 0) },
        "15": { avista: parseFloat(document.getElementById('p15v').value || 0), prazo: parseFloat(document.getElementById('p15p').value || 0) },
        "20": { avista: parseFloat(document.getElementById('p20v').value || 0), prazo: parseFloat(document.getElementById('p20p').value || 0) },
        "precoArgamassa": parseFloat(document.getElementById('precoArgamassa').value || 0),
        "precoPU": parseFloat(document.getElementById('precoPU').value || 0),
        "precoTela": parseFloat(document.getElementById('precoTela').value || 0),
        "custoConvBruto": parseFloat(document.getElementById('custoConvBruto').value || 0),
        "custoConvPronto": parseFloat(document.getElementById('custoConvPronto').value || 0),
        "custoBlocokMO": parseFloat(document.getElementById('custoBlocokMO').value || 0),
        "produtividadeDiaria": parseFloat(document.getElementById('produtividadeDiaria').value || 15)
    };

    try {
        await db.collection("configuracoes").doc("precosGlobais").set(novosPrecos);
        precosBlocok = novosPrecos;
        alert("Configurações atualizadas com sucesso na Nuvem! Todos os vendedores já estão com os novos valores.");
    } catch (error) { alert("Erro ao salvar preços."); } finally {
        btn.innerText = "💾 SALVAR TODOS OS PREÇOS E CONFIGURAÇÕES NO SERVIDOR"; btn.disabled = false;
    }
};

// ==========================================
// 📁 MOTOR DE LOGIN E SESSÃO
// ==========================================

function aplicarRestricoes(perfil) {
    if (perfil === 'admin') {
        document.getElementById('painelAdmin').style.display = 'block'; 
    } else if (perfil === 'vendedor') {
        document.getElementById('painelAdmin').style.display = 'none'; 
        document.getElementById('btnLimpar').style.display = 'none';
        document.getElementById('btnExcluirProjeto').style.display = 'none';
        
        // CORREÇÃO: Usando 'disabled' o campo vira pedra e ninguém muda nem na setinha
        const camposBloqueados = ['precoArgamassa', 'precoPU', 'precoTela', 'custoConvBruto', 'custoConvPronto', 'custoBlocokMO', 'produtividadeDiaria'];
        camposBloqueados.forEach(id => {
            let campo = document.getElementById(id);
            if(campo) {
                campo.disabled = true; // Isso bloqueia totalmente
                campo.style.pointerEvents = "none";
                campo.style.backgroundColor = "#1e293b"; 
                campo.style.color = "#64748b";
                campo.title = "Apenas o Admin pode alterar este valor.";
            }
        });
    }
}

function verificarSessao() {
    const logado = sessionStorage.getItem('blocok_logado');
    const perfil = sessionStorage.getItem('blocok_perfil');
    if (logado === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        aplicarRestricoes(perfil);
        carregarEstadoLocal();
        atualizarSelectProjetosNuvem();
        carregarPrecosDaNuvem(); // Nuvem sobrescreve o Auto-save (Garante preço atualizado)
    }
}

document.getElementById('btnLogin').onclick = () => {
    const user = document.getElementById('userInput').value.trim().toLowerCase();
    const pass = document.getElementById('passInput').value;
    const erro = document.getElementById('loginError');

    if (USUARIOS[user] && USUARIOS[user].senha === pass) {
        sessionStorage.setItem('blocok_logado', 'true');
        sessionStorage.setItem('blocok_perfil', USUARIOS[user].perfil);
        location.reload();
    } else {
        erro.style.display = 'block'; setTimeout(() => { erro.style.display = 'none'; }, 3000);
    }
};

document.getElementById('btnLogout').onclick = () => { sessionStorage.removeItem('blocok_logado'); sessionStorage.removeItem('blocok_perfil'); location.reload(); };

// ==========================================
// 📁 AUTO-SAVE LOCAL E BANCO DE DADOS
// ==========================================

async function atualizarSelectProjetosNuvem() {
    const select = document.getElementById('selectProjetos'); if(!select || !db) return;
    select.innerHTML = '<option value="">⏳ Carregando obras da Nuvem...</option>';
    try {
        const snapshot = await db.collection("obras").get(); select.innerHTML = '<option value="">-- Abrir Obra da Nuvem --</option>';
        if(snapshot.empty) { select.innerHTML = '<option value="">Nenhuma obra salva ainda</option>'; return; }
        snapshot.forEach(doc => { select.innerHTML += `<option value="${doc.id}">${doc.id}</option>`; });
    } catch (error) { select.innerHTML = '<option value="">Erro ao conectar na nuvem</option>'; }
}

function salvarEstadoLocal() {
    const dados = { paredes: paredesMedidas, escala: pixelsPorMetro, inputs: {} };
    document.querySelectorAll('.save-state').forEach(input => {
        if(input.type === 'checkbox') dados.inputs[input.id] = input.checked; else dados.inputs[input.id] = input.value;
    });
    try { if(imagemPlanta.src && !imagemPlanta.src.startsWith('file')) localStorage.setItem('blocokImage', imagemPlanta.src); } catch(e) {}
    localStorage.setItem('blocokData', JSON.stringify(dados));
}

function carregarEstadoLocal() {
    try {
        const dataJSON = localStorage.getItem('blocokData');
        if(dataJSON) {
            const dados = JSON.parse(dataJSON);
            paredesMedidas = dados.paredes || []; if (paredesMedidas.length > 0 && typeof paredesMedidas[0] === 'number') paredesMedidas = [];
            pixelsPorMetro = dados.escala || 0;

            for (let id in dados.inputs) {
                let el = document.getElementById(id);
                const perfil = sessionStorage.getItem('blocok_perfil');
                const isPriceField = ['precoArgamassa', 'precoPU', 'precoTela', 'custoConvBruto', 'custoConvPronto', 'custoBlocokMO', 'produtividadeDiaria'].includes(id);
                
                if(el && !(perfil === 'vendedor' && isPriceField)) {
                    if(el.type === 'checkbox') {
                        if (dados.inputs[id] !== undefined) el.checked = dados.inputs[id];
                    } else {
                        if (dados.inputs[id] !== undefined) el.value = dados.inputs[id];
                    }
                }
            }
            atualizarTabela();
            if(pixelsPorMetro > 0) { document.getElementById('btnMedir').disabled = false; document.getElementById('btnMedir').style.borderColor = '#ff6b00'; document.getElementById('btnMedir').style.color = '#ff6b00'; }
        }
        const savedImage = localStorage.getItem('blocokImage'); if(savedImage) imagemPlanta.src = savedImage;
    } catch (erro) { localStorage.removeItem('blocokData'); paredesMedidas = []; }
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    if(!db) return alert("Conexão falhou."); let nome = document.getElementById('nomeProjetoAtivo').value.trim(); if(!nome) return alert("Digite um nome.");
    let btn = document.getElementById('btnSalvarProjeto'); btn.innerText = "⏳..."; btn.disabled = true; salvarEstadoLocal(); 
    const currentData = JSON.parse(localStorage.getItem('blocokData')); const currentImage = localStorage.getItem('blocokImage'); if (currentImage) currentData.imagem = currentImage;
    try { await db.collection("obras").doc(nome).set(currentData); alert(`Salvo!`); atualizarSelectProjetosNuvem(); } catch (error) { alert("Erro ao salvar."); } finally { btn.innerText = "💾 Salvar na Nuvem"; btn.disabled = false; }
};

document.getElementById('btnCarregarProjeto').onclick = async () => {
    if(!db) return; let nome = document.getElementById('selectProjetos').value; if(!nome) return alert("Selecione.");
    if(confirm("Substituir área atual?")) {
        let btn = document.getElementById('btnCarregarProjeto'); btn.innerText = "⏳...";
        try {
            const docRef = await db.collection("obras").doc(nome).get();
            if (docRef.exists) {
                let dados = docRef.data(); if (dados.imagem) { localStorage.setItem('blocokImage', dados.imagem); delete dados.imagem; } else localStorage.removeItem('blocokImage');
                localStorage.setItem('blocokData', JSON.stringify(dados)); location.reload(); 
            } else alert("Não encontrada.");
        } catch(error) { alert("Erro."); } finally { btn.innerText = "📂 Abrir"; }
    }
};

document.getElementById('btnExcluirProjeto').onclick = async () => {
    if(!db) return; let nome = document.getElementById('selectProjetos').value; if(!nome) return alert("Selecione.");
    if(confirm(`APAGAR '${nome}'?`)) { try { await db.collection("obras").doc(nome).delete(); alert("Excluída."); atualizarSelectProjetosNuvem(); } catch(error) { alert("Erro."); } }
};

document.getElementById('btnLimpar').onclick = () => { if(confirm("Apagar Área de Trabalho?")) { localStorage.removeItem('blocokData'); localStorage.removeItem('blocokImage'); location.reload(); } };
document.querySelectorAll('.save-state').forEach(input => { input.addEventListener('change', salvarEstadoLocal); input.addEventListener('input', salvarEstadoLocal); });

const chkInsumos = document.getElementById('chkInsumos'); const painelInsumos = document.getElementById('painelInsumos'); chkInsumos.addEventListener('change', () => { painelInsumos.style.display = chkInsumos.checked ? 'block' : 'none'; salvarEstadoLocal(); });
const chkComparativo = document.getElementById('chkComparativo'); const painelComparativo = document.getElementById('painelComparativo'); chkComparativo.addEventListener('change', () => { painelComparativo.style.display = chkComparativo.checked ? 'block' : 'none'; salvarEstadoLocal(); });
const chkCronograma = document.getElementById('chkCronograma'); const painelCronograma = document.getElementById('painelCronograma'); chkCronograma.addEventListener('change', () => { painelCronograma.style.display = chkCronograma.checked ? 'block' : 'none'; salvarEstadoLocal(); });

// ==========================================
// 🛠️ LEVANTAMENTO E CALCULADORA
// ==========================================

document.getElementById('uploadPlanta').onchange = (e) => { const reader = new FileReader(); reader.onload = (ev) => { imagemPlanta.src = ev.target.result; salvarEstadoLocal(); }; reader.readAsDataURL(e.target.files[0]); };
imagemPlanta.onload = () => { canvas.width = imagemPlanta.width; canvas.height = imagemPlanta.height; ctx.drawImage(imagemPlanta, 0, 0); document.getElementById('btnCalibrar').disabled = false; document.getElementById('btnCalibrar').style.borderColor = '#00f0ff'; document.getElementById('btnCalibrar').style.color = '#00f0ff'; statusBar.innerText = "Planta pronta."; };
document.getElementById('btnCalibrar').onclick = () => { estadoAtual = 'calibrando_p1'; statusBar.innerText = "Clique no PONTO 1."; };
document.getElementById('btnMedir').onclick = () => { if(pixelsPorMetro === 0) return alert("Calibre!"); estadoAtual = 'medindo_p1'; statusBar.innerText = "Clique INÍCIO."; };
canvas.onclick = (e) => {
    const x = e.offsetX; const y = e.offsetY;
    if (estadoAtual === 'calibrando_p1') { ponto1 = {x, y}; estadoAtual = 'calibrando_p2'; ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#00f0ff'; ctx.fill(); } 
    else if (estadoAtual === 'calibrando_p2') {
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#00f0ff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(ponto1.x, ponto1.y); ctx.lineTo(x,y); ctx.strokeStyle='#00f0ff'; ctx.stroke();
        let real = prompt("METROS REAIS? (Ex: 0.80)");
        if(real && !isNaN(real.replace(',','.'))) { pixelsPorMetro = Math.sqrt(Math.pow(x-ponto1.x, 2) + Math.pow(y-ponto1.y, 2)) / parseFloat(real.replace(',','.')); document.getElementById('btnMedir').disabled = false; document.getElementById('btnMedir').style.borderColor = '#ff6b00'; document.getElementById('btnMedir').style.color = '#ff6b00'; estadoAtual = 'ocioso'; statusBar.innerText = "Escala pronta."; salvarEstadoLocal(); }
    } else if (estadoAtual === 'medindo_p1') { ponto1 = {x, y}; estadoAtual = 'medindo_p2'; ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#ff6b00'; ctx.fill(); } 
    else if (estadoAtual === 'medindo_p2') {
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#ff6b00'; ctx.fill(); ctx.beginPath(); ctx.moveTo(ponto1.x, ponto1.y); ctx.lineTo(x,y); ctx.strokeStyle='#ff6b00'; ctx.lineWidth=3; ctx.stroke();
        let m = Math.sqrt(Math.pow(x-ponto1.x, 2) + Math.pow(y-ponto1.y, 2)) / pixelsPorMetro; adicionarParede(m, document.getElementById('espessuraCorrente').value); estadoAtual = 'ocioso'; statusBar.innerText = "Parede gravada.";
    }
};
document.getElementById('btnAdicionarManual').onclick = () => { let input = document.getElementById('comprimentoManual'); let v = parseFloat(input.value.replace(',','.')); if(v > 0) adicionarParede(v, document.getElementById('espessuraCorrente').value); input.value = ''; };
document.getElementById('btnAdicionarOitao').onclick = () => {
    let b = parseFloat(document.getElementById('baseOitao').value.replace(',','.')); let a = parseFloat(document.getElementById('alturaOitao').value.replace(',','.')); let esp = document.getElementById('espessuraCorrente').value;
    if(b > 0 && a > 0) { paredesMedidas.push({ tipo: 'oitao', comp: b, alturaOitao: a, esp: esp, areaVaos: 0, areaFixa: (b * a) / 2 }); atualizarTabela(); salvarEstadoLocal(); document.getElementById('baseOitao').value = ''; document.getElementById('alturaOitao').value = ''; } else alert("Preencha Base e Altura.");
};
function adicionarParede(comp, esp) { paredesMedidas.push({ tipo: 'parede', comp: comp, esp: esp, areaVaos: 0, areaFixa: 0 }); atualizarTabela(); salvarEstadoLocal(); }
function removerP(index) { paredesMedidas.splice(index, 1); atualizarTabela(); salvarEstadoLocal(); }
window.addVao = function(index) { let l = prompt(`LARGURA vão (m):`); if (!l || isNaN(l.replace(',','.'))) return; let a = prompt(`ALTURA vão (m):`); if (!a || isNaN(a.replace(',','.'))) return; paredesMedidas[index].areaVaos += (parseFloat(l.replace(',','.')) * parseFloat(a.replace(',','.'))); atualizarTabela(); salvarEstadoLocal(); };
function atualizarTabela() {
    const t = document.getElementById('corpoTabela'); if(!t) return; t.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        let txtVao = p.areaVaos > 0 ? `<span style="color:#ef4444;font-weight:bold;">-${p.areaVaos.toFixed(2)}</span>` : "0.00"; let desc = p.tipo === 'oitao' ? `B:${p.comp.toFixed(2)} x A:${p.alturaOitao.toFixed(2)}` : `${p.comp.toFixed(2)}m`; let badgeTipo = p.tipo === 'oitao' ? `<span style="color:#a855f7; font-weight:bold;">🔺 Oitão P${i+1}</span>` : `Parede P${i+1}`;
        t.innerHTML += `<tr><td>${badgeTipo}</td><td>${desc}</td><td><span class="badge-esp">${p.esp}cm</span></td><td>${txtVao}</td><td class="acoes-tabela"><button type="button" class="btn-add-vao" onclick="addVao(${i})">+ Vão</button><button type="button" class="btn-remover" onclick="removerP(${i})">X</button></td></tr>`;
    });
}
document.getElementById('btnExportarExcel').onclick = () => {
    if(paredesMedidas.length === 0) return alert("Lista vazia."); let csv = "Item;Tipo;Espessura(cm);Comp_Base(m);Altura_Oitao(m);Area_Vaos(m2)\n";
    paredesMedidas.forEach((p, i) => { csv += `${i+1};${p.tipo ? p.tipo.toUpperCase() : 'PAREDE'};${p.esp};${p.comp.toFixed(2)};${p.tipo === 'oitao' ? p.alturaOitao.toFixed(2) : "-"};${p.areaVaos.toFixed(2)}\n`; });
    let blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `BLOCOK_${new Date().getTime()}.csv`; link.click();
};

// ==========================================
// 🚀 GERAÇÃO DO PDF
// ==========================================

verificarSessao();

document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault(); salvarEstadoLocal(); 
    if(paredesMedidas.length === 0) return alert("Lista vazia.");

    let nome = document.getElementById('nomeProjetoAtivo').value || document.getElementById('whatsappCliente').value || "Cliente";
    let telefone = document.getElementById('whatsappCliente').value.replace(/\D/g, '');
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    
    let incluirInsumos = document.getElementById('chkInsumos').checked;
    let incluirComparativo = document.getElementById('chkComparativo').checked;
    let incluirCronograma = document.getElementById('chkCronograma').checked;
    let produtividade = parseFloat(document.getElementById('produtividadeDiaria').value || 15);

    let totalAreaBruta = 0, totalAreaLiquida = 0, valorTotalBlocos = 0, qtdTotalBlocos = 0;
    let resumoParedes = {}; 
    
    paredesMedidas.forEach(p => {
        if(!resumoParedes[p.esp]) resumoParedes[p.esp] = { bruta: 0, vaos: 0, liquida: 0 };
        let areaBrutaParede = p.tipo === 'oitao' ? p.areaFixa : (p.comp * h);
        let areaLiquidaParede = Math.max(0, areaBrutaParede - p.areaVaos);
        resumoParedes[p.esp].bruta += areaBrutaParede; resumoParedes[p.esp].vaos += p.areaVaos; resumoParedes[p.esp].liquida += areaLiquidaParede;
        totalAreaBruta += areaBrutaParede; totalAreaLiquida += areaLiquidaParede;
    });

    let html = `
    <div id="pdfContent" style="padding: 30px; font-family: Arial, sans-serif; position: relative; overflow: hidden; background: white; color: black; min-height: 800px;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 140px; color: rgba(0, 0, 0, 0.04); font-weight: 900; letter-spacing: 15px; z-index: 0; pointer-events: none;">BLOCOK</div>
        <div style="position: relative; z-index: 1;">
            <div style="border-bottom: 2px solid #ff6b00; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #2c3e50; margin: 0 0 5px 0;">PROPOSTA TÉCNICA - SISTEMA BLOCOK</h1>
                <p><strong>Cliente / Projeto:</strong> ${nome.toUpperCase()} | <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <h3 style="color: #2c3e50;">1. Quantitativo de Painéis (${pag.toUpperCase()})</h3>
            <table class="pdf-table"><tr><th>Espessura</th><th>Área Bruta</th><th>Descontos</th><th>Área Real</th><th>Qtd. Peças</th><th>Subtotal</th></tr>`;

    for (let esp in resumoParedes) {
        let d = resumoParedes[esp]; if (d.bruta === 0) continue;
        let qtd = Math.ceil(d.liquida / 0.81); let preco = precosBlocok[esp][pag] * qtd;
        qtdTotalBlocos += qtd; valorTotalBlocos += preco;
        html += `<tr><td><strong>${esp} cm</strong></td><td>${d.bruta.toFixed(2)} m²</td><td style="color:#e74c3c;">- ${d.vaos.toFixed(2)} m²</td><td style="color:#27ae60; font-weight:bold;">${d.liquida.toFixed(2)} m²</td><td>${qtd} un.</td><td>R$ ${preco.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>`;
    }
    html += `</table>`;

    let valorTotalInsumos = 0;
    if (incluirInsumos) {
        let sacos = Math.ceil(totalAreaLiquida / 10), tubos = Math.ceil(totalAreaLiquida / 3), rolos = Math.ceil((totalAreaLiquida * 2.2) / 50);
        let pArg = parseFloat(document.getElementById('precoArgamassa').value || 0), pPU = parseFloat(document.getElementById('precoPU').value || 0), pTela = parseFloat(document.getElementById('precoTela').value || 0);
        valorTotalInsumos = (sacos * pArg) + (tubos * pPU) + (rolos * pTela);
        html += `<h3 style="color: #2c3e50; margin-top: 20px;">2. Materiais de Instalação</h3>
            <table class="pdf-table"><tr><th>Insumo</th><th>Qtd.</th><th>Valor Unit.</th><th>Subtotal</th></tr>
            <tr><td>Argamassa (20kg)</td><td>${sacos} scs</td><td>R$ ${pArg.toFixed(2)}</td><td>R$ ${(sacos*pArg).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
            <tr><td>Espuma PU (500ml)</td><td>${tubos} un.</td><td>R$ ${pPU.toFixed(2)}</td><td>R$ ${(tubos*pPU).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
            <tr><td>Tela Fibra (50m)</td><td>${rolos} rls</td><td>R$ ${pTela.toFixed(2)}</td><td>R$ ${(rolos*pTela).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr></table>`;
    }

    let valorGlobalObra = valorTotalBlocos + valorTotalInsumos;
    html += `<div class="resumo-financeiro"><div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;"><span>Total Blocos:</span><strong>R$ ${valorTotalBlocos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div>`;
    if(incluirInsumos) html += `<div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;"><span>Total Insumos:</span><strong>R$ ${valorTotalInsumos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div>`;
    html += `<div style="display:flex; justify-content:space-between; font-size:18px; color:#2c3e50; margin-top:10px;"><strong>TOTAL PRODUTOS:</strong><strong style="color:#ff6b00;">R$ ${valorGlobalObra.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div></div>`;

    // CORREÇÃO: CRONOGRAMA GARANTIDO NO PDF
    let diasEstimados = totalAreaLiquida > 0 ? Math.ceil(totalAreaLiquida / produtividade) : 0;
    if (incluirCronograma) {
        html += `
            <h3 style="color: #2c3e50; margin-top: 25px;">3. Cronograma Estimado de Montagem</h3>
            <div style="background: #f8f9fa; border: 1px solid #ccc; padding: 15px; border-radius: 6px; border-left: 5px solid #10b981;">
                <p style="margin: 0 0 10px 0; color: #333; font-size: 13px;">Baseado em uma produtividade média de <strong>${produtividade} m²/dia</strong> por equipe (1 Oficial + 1 Auxiliar).</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 14px; font-weight: bold;">Tempo estimado de montagem das paredes:</span>
                    <strong style="font-size: 18px; color: #10b981; background: #e8f8f5; padding: 5px 15px; border-radius: 4px;">${diasEstimados} dia(s) útil(eis)</strong>
                </div>
            </div>`;
    }

    let economiaReais = 0;
    if (incluirComparativo) {
        let totalConvPronto = totalAreaLiquida * parseFloat(document.getElementById('custoConvPronto').value || 0);
        let totalConvBruto = totalAreaLiquida * parseFloat(document.getElementById('custoConvBruto').value || 0);
        let totalBlocokPronto = valorGlobalObra + (totalAreaLiquida * parseFloat(document.getElementById('custoBlocokMO').value || 0));
        let totalBlocokBruto = valorGlobalObra;
        economiaReais = totalConvPronto - totalBlocokPronto;
        
        let numeracao = incluirCronograma ? "4" : "3";
        
        html += `<h3 style="color:#2c3e50; margin-top:25px;">${numeracao}. Análise de Viabilidade Financeira</h3>
            <div class="box-comparativo">
            <h4 style="margin: 0 0 10px 0; color: #555;">A. Somente Material (Alvenaria Bruta)</h4>
            <div class="grafico-linha"><span class="lbl-grafico">Tijolo Conv.</span><div class="barra-bg"><div class="barra-fill-bad" style="width: 100%;">&nbsp;</div></div><span class="val-grafico" style="color:#e74c3c;">R$ ${totalConvBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div>
            <div class="grafico-linha"><span class="lbl-grafico">BLOCOK</span><div class="barra-bg"><div class="barra-fill-good" style="width: ${(totalBlocokBruto/totalConvBruto > 1 ? 100 : (totalBlocokBruto/totalConvBruto)*100)}%;">&nbsp;</div></div><span class="val-grafico" style="color:#27ae60;">R$ ${totalBlocokBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div>
            
            <h4 style="margin: 15px 0 10px 0; color: #2c3e50;">B. Parede Pronta (Material + Mão de Obra)</h4>
            <div class="grafico-linha"><span class="lbl-grafico">Convencional</span><div class="barra-bg"><div class="barra-fill-bad" style="width: 100%;">&nbsp;</div></div><span class="val-grafico" style="color:#e74c3c;">R$ ${totalConvPronto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div>
            <div class="grafico-linha"><span class="lbl-grafico">BLOCOK Pronto</span><div class="barra-bg"><div class="barra-fill-good" style="width: ${(totalBlocokPronto/totalConvPronto)*100}%;">&nbsp;</div></div><span class="val-grafico" style="color:#27ae60;">R$ ${totalBlocokPronto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div>
            
            <div style="text-align:center; margin-top:15px; background:#e8f8f5; padding:10px; color:#27ae60; font-weight:bold; border-radius: 4px;">Economia Estimada: R$ ${economiaReais > 0 ? economiaReais.toLocaleString('pt-BR', {minimumFractionDigits:2}) : "0,00"}</div></div>`;
    }

    html += `<p style="font-size:10px; text-align:center; margin-top:20px; color: #95a5a6;">* Documento gerado digitalmente pelo BLOCOK OS.</p></div></div>
    <div style="display:flex; gap:10px; margin-top:20px;"><button id="downloadPdf" style="flex:1; padding:15px; background:#ef4444; color:white; border:none; font-weight:bold; border-radius:6px; cursor:pointer;">📄 BAIXAR PDF</button>
    <button id="sendWhatsApp" style="flex:1; padding:15px; background:#10b981; color:white; border:none; font-weight:bold; border-radius:6px; cursor:pointer;">💬 MANDAR NO ZAP</button></div>`;

    const caixa = document.getElementById('caixaResultado'); caixa.innerHTML = html; caixa.style.display = 'block';

    document.getElementById('downloadPdf').onclick = () => {
        const btn = document.getElementById('downloadPdf'); btn.innerText = "⏳ Gerando..."; btn.style.backgroundColor = "#475569";
        html2pdf().set({ margin:0, filename:`BLOCOK_${nome.replace(/\s+/g, '_')}.pdf`, html2canvas:{scale:2, scrollY:0}, jsPDF:{unit:'mm', format:'a4', orientation:'portrait'} }).from(document.getElementById('pdfContent')).save().then(() => {
            btn.innerText = "✅ PDF Salvo!"; btn.style.backgroundColor = "#10b981";
            setTimeout(() => { btn.innerText = "📄 BAIXAR PDF"; btn.style.backgroundColor = "#ef4444"; }, 3000);
        });
    };

    document.getElementById('sendWhatsApp').onclick = () => {
        if(!telefone) return alert("Preencha o WhatsApp do cliente.");
        let texto = `*PROPOSTA TÉCNICA - BLOCOK* 🧱\n\nOlá, *${nome.toUpperCase()}*! Segue o resumo:\n\n📏 *Área Total:* ${totalAreaLiquida.toFixed(2)} m²\n💰 *TOTAL PRODUTOS:* R$ ${valorGlobalObra.toLocaleString('pt-BR', {minimumFractionDigits:2})}\n`;
        if(incluirCronograma && diasEstimados > 0) { texto += `⏱️ *Tempo de Montagem:* Apenas ${diasEstimados} dia(s) útil(eis)!\n`; }
        if(economiaReais > 0) texto += `✅ *Economia Estimada:* R$ ${economiaReais.toLocaleString('pt-BR', {minimumFractionDigits:2})} em relação à alvenaria pronta!\n`;
        texto += `\nEstou enviando o *PDF detalhado* a seguir!`;
        window.open(`https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(texto)}`, '_blank');
    };
};