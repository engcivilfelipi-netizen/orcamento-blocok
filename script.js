// ==========================================
// 🔒 INICIALIZAÇÃO FIREBASE E VARIÁVEIS
// ==========================================
let db, auth;
let precosBlocok = { "10":{avista:0,prazo:0}, "13":{avista:0,prazo:0}, "15":{avista:0,prazo:0}, "20":{avista:0,prazo:0}, descontoMaximo: 5 };
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
            ['precoArgamassa', 'precoPU', 'precoTela', 'custoConvPronto', 'custoBlocokMO', 'produtividadeDiaria'].forEach(id => {
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
    catch (e) { document.getElementById('loginError').style.display = 'block'; }
};
document.getElementById('btnLogout').onclick = () => auth.signOut();

// ==========================================
// ⚙️ GESTÃO DE NUVEM (PREÇOS E VISUAL)
// ==========================================
async function carregarPrecosDaNuvem() {
    const doc = await db.collection("configuracoes").doc("precosGlobais").get();
    if (doc.exists) {
        precosBlocok = doc.data();
        if(auth.currentUser.email === 'admin@blocok.com') {
            document.getElementById('p10v').value = precosBlocok["10"].avista; document.getElementById('p10p').value = precosBlocok["10"].prazo;
            document.getElementById('p13v').value = precosBlocok["13"].avista; document.getElementById('p13p').value = precosBlocok["13"].prazo;
            document.getElementById('p15v').value = precosBlocok["15"].avista; document.getElementById('p15p').value = precosBlocok["15"].prazo;
            document.getElementById('p20v').value = precosBlocok["20"].avista; document.getElementById('p20p').value = precosBlocok["20"].prazo;
            document.getElementById('descontoMax').value = precosBlocok.descontoMaximo || 5;
        }
    }
}

document.getElementById('btnSalvarPrecosGlobais').onclick = async () => {
    const novos = {
        "10": { avista: parseFloat(document.getElementById('p10v').value), prazo: parseFloat(document.getElementById('p10p').value) },
        "13": { avista: parseFloat(document.getElementById('p13v').value), prazo: parseFloat(document.getElementById('p13p').value) },
        "15": { avista: parseFloat(document.getElementById('p15v').value), prazo: parseFloat(document.getElementById('p15p').value) },
        "20": { avista: parseFloat(document.getElementById('p20v').value), prazo: parseFloat(document.getElementById('p20p').value) },
        "descontoMaximo": parseFloat(document.getElementById('descontoMax').value)
    };
    await db.collection("configuracoes").doc("precosGlobais").set(novos);
    precosBlocok = novos; alert("Configurações Salvas!");
};

async function carregarIdentidadeVisualDaNuvem() {
    const doc = await db.collection("configuracoes").doc("identidadeVisual").get();
    if (doc.exists) {
        configVisualNuvem = doc.data();
        document.getElementById('inputCorDestaque').value = configVisualNuvem.cor;
    }
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
            alert("Logo carregada! Lembre-se de clicar em Salvar Visual.");
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
        t.innerHTML += `<tr><td>${i+1}</td><td>${p.comp.toFixed(2)}m</td><td>${p.esp}cm</td><td><button class="btn-tech-danger" onclick="removerP(${i})">X</button></td></tr>`;
    });
}
window.removerP = (i) => { paredesMedidas.splice(i, 1); renderizarTabela(); };

// ==========================================
// 🚀 GERAÇÃO DE PROPOSTA E ROMANEIO (AJUSTE FINO DE CORTES)
// ==========================================
document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    if(paredesMedidas.length === 0) return alert("Meça as paredes primeiro.");

    const isAdmin = (auth.currentUser.email === 'admin@blocok.com');
    let descPct = parseFloat(document.getElementById('valorDesconto').value || 0);
    if (!isAdmin && descPct > precosBlocok.descontoMaximo) {
        alert(`❌ O desconto máximo permitido é de ${precosBlocok.descontoMaximo}%! Valor corrigido automaticamente.`);
        document.getElementById('valorDesconto').value = precosBlocok.descontoMaximo;
        descPct = precosBlocok.descontoMaximo;
    }

    let nome = document.getElementById('nomeProjetoAtivo').value || "CLIENTE";
    let telefone = document.getElementById('whatsappCliente').value.replace(/\D/g, '');
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    let cor = configVisualNuvem.cor;
    let frete = parseFloat(document.getElementById('valorFrete').value || 0);

    let totalM2 = 0; let resumo = {};
    paredesMedidas.forEach(p => { 
        let m2 = p.comp * h; totalM2 += m2; 
        if(!resumo[p.esp]) resumo[p.esp] = 0; resumo[p.esp] += m2; 
    });

    let tagLogoPdf = configVisualNuvem.logo ? `<img src="${configVisualNuvem.logo}" style="max-height: 80px; max-width: ${configVisualNuvem.tamanho}%; display: block; margin-left: auto;">` : '';

    // --- HTML DO PDF PRINCIPAL ---
    // Removi as larguras fixas em pixels (ex: 794px) para deixar o componente fluido.
    let htmlPdf = `
    <div id="pdfContent" style="padding: 20px; font-family: Arial, sans-serif; background: white; color: black; box-sizing: border-box;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: none;">
            <tr><td style="width: 50%; border: none;"></td><td style="width: 50%; text-align: right; vertical-align: middle; border: none; padding-bottom: 10px;">${tagLogoPdf}</td></tr>
        </table>

        <div style="border-bottom: 3px solid ${cor}; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; margin: 0 0 5px 0; font-size: 24px;">PROPOSTA COMERCIAL</h1>
            <p style="margin: 0; font-size: 14px;"><strong>Cliente / Obra:</strong> ${nome.toUpperCase()} | <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        
        <h3 style="color: #2c3e50; margin-top: 20px; font-size: 16px;">1. Quantitativo de Painéis Estruturais (${pag.toUpperCase()})</h3>
        <table class="pdf-table" style="font-size: 13px; width: 100%; text-align: left; border-collapse: collapse;">
            <tr style="background: ${cor}; color: #fff;">
                <th style="padding: 8px; border: 1px solid #ccc;">Espessura</th>
                <th style="padding: 8px; border: 1px solid #ccc;">Área Real</th>
                <th style="padding: 8px; border: 1px solid #ccc;">Qtd. Peças</th>
                <th style="padding: 8px; border: 1px solid #ccc;">Subtotal</th>
            </tr>`;

    let totalProdutos = 0; let romaneioRows = '';
    for(let esp in resumo) {
        let m2 = resumo[esp]; let qtd = Math.ceil(m2 / 0.81);
        let precoUnit = precosBlocok[esp] ? precosBlocok[esp][pag] : 0;
        let sub = qtd * precoUnit; totalProdutos += sub;
        htmlPdf += `<tr>
            <td style="border:1px solid #ccc; padding:8px;"><strong>${esp} cm</strong></td>
            <td style="border:1px solid #ccc; padding:8px;">${m2.toFixed(2)} m²</td>
            <td style="border:1px solid #ccc; padding:8px;">${qtd} un.</td>
            <td style="border:1px solid #ccc; padding:8px;">R$ ${sub.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
        </tr>`;
        romaneioRows += `<tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Painel BLOCOK ${esp} cm</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;"><strong>${qtd} peças</strong></td>
        </tr>`;
    }
    htmlPdf += `</table>`;

    // INSUMOS
    if(document.getElementById('chkInsumos').checked) {
        let sacos = Math.ceil(totalM2 / 10), tubos = Math.ceil(totalM2 / 3), rolos = Math.ceil((totalM2 * 2.2) / 50);
        let pArg = parseFloat(document.getElementById('precoArgamassa').value || 0), pPU = parseFloat(document.getElementById('precoPU').value || 0), pTela = parseFloat(document.getElementById('precoTela').value || 0);
        totalProdutos += (sacos * pArg) + (tubos * pPU) + (rolos * pTela);
        htmlPdf += `<h3 style="color: #2c3e50; margin-top: 20px; font-size: 16px;">2. Materiais de Instalação</h3>
            <table class="pdf-table" style="font-size: 13px; width: 100%; text-align: left; border-collapse: collapse;">
                <tr style="background: ${cor}; color: #fff;">
                    <th style="padding: 8px; border: 1px solid #ccc;">Insumo</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">Qtd.</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">Valor Unit.</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">Subtotal</th>
                </tr>
                <tr><td style="border:1px solid #ccc; padding:8px;">Argamassa (20kg)</td><td style="border:1px solid #ccc; padding:8px;">${sacos} scs</td><td style="border:1px solid #ccc; padding:8px;">R$ ${pArg.toFixed(2)}</td><td style="border:1px solid #ccc; padding:8px;">R$ ${(sacos*pArg).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
                <tr><td style="border:1px solid #ccc; padding:8px;">Espuma PU (500ml)</td><td style="border:1px solid #ccc; padding:8px;">${tubos} un.</td><td style="border:1px solid #ccc; padding:8px;">R$ ${pPU.toFixed(2)}</td><td style="border:1px solid #ccc; padding:8px;">R$ ${(tubos*pPU).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
                <tr><td style="border:1px solid #ccc; padding:8px;">Tela Fibra (50m)</td><td style="border:1px solid #ccc; padding:8px;">${rolos} rls</td><td style="border:1px solid #ccc; padding:8px;">R$ ${pTela.toFixed(2)}</td><td style="border:1px solid #ccc; padding:8px;">R$ ${(rolos*pTela).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
            </table>`;
        romaneioRows += `<tr><td style="border: 1px solid #000; padding: 8px; text-align: center;">Argamassa (20kg)</td><td style="border: 1px solid #000; padding: 8px; text-align: center;"><strong>${sacos} sacos</strong></td></tr>`;
        romaneioRows += `<tr><td style="border: 1px solid #000; padding: 8px; text-align: center;">Espuma PU (500ml)</td><td style="border: 1px solid #000; padding: 8px; text-align: center;"><strong>${tubos} tubos</strong></td></tr>`;
        romaneioRows += `<tr><td style="border: 1px solid #000; padding: 8px; text-align: center;">Tela Fibra (50m)</td><td style="border: 1px solid #000; padding: 8px; text-align: center;"><strong>${rolos} rolos</strong></td></tr>`;
    }

    let valDesc = totalProdutos * (descPct/100);
    let totalFinal = totalProdutos - valDesc + frete;

    // FINANCEIRO
    htmlPdf += `<div class="resumo-financeiro" style="font-size: 14px; margin-top: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;"><span>Subtotal:</span><strong>R$ ${totalProdutos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div>`;
    if (descPct > 0) htmlPdf += `<div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px; color: #ef4444;"><span>Desconto (${descPct}%):</span><strong>- R$ ${valDesc.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div>`;
    if (frete > 0) htmlPdf += `<div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px; color: #3b82f6;"><span>Frete:</span><strong>+ R$ ${frete.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div>`;
    htmlPdf += `<div style="display:flex; justify-content:space-between; font-size:18px; color:#2c3e50; margin-top:10px;"><strong>TOTAL A PAGAR:</strong><strong style="color:${cor};">R$ ${totalFinal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div></div>`;

    // CRONOGRAMA E COMPARATIVO
    if(document.getElementById('chkCronograma').checked) {
        let dias = Math.ceil(totalM2 / parseFloat(document.getElementById('produtividadeDiaria').value));
        htmlPdf += `<h3 style="color: #2c3e50; margin-top: 25px; font-size: 16px;">3. Cronograma Estimado de Montagem</h3>
            <div style="background: #f8f9fa; border: 1px solid #ccc; padding: 15px; border-radius: 6px; border-left: 5px solid ${cor};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 14px; font-weight: bold;">Tempo estimado de montagem:</span>
                    <strong style="font-size: 18px; color: ${cor};">Aprox. ${dias} dia(s) útil(eis)</strong>
                </div>
            </div>`;
    }

    if(document.getElementById('chkComparativo').checked) {
        let conv = totalM2 * parseFloat(document.getElementById('custoConvPronto').value || 0);
        let seu = totalFinal + (totalM2 * parseFloat(document.getElementById('custoBlocokMO').value || 0));
        let econo = conv - seu; let num = document.getElementById('chkCronograma').checked ? "4" : "3";
        
        htmlPdf += `<h3 style="color:#2c3e50; margin-top:25px; font-size: 16px;">${num}. Análise de Viabilidade Financeira</h3>
            <div class="box-comparativo" style="font-size: 13px; background: #fff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #555; font-size: 14px;">Parede Pronta (Material + Mão de Obra)</h4>
            <div style="margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Convencional</span><span style="color:#e74c3c; font-weight: bold;">R$ ${conv.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div><div style="width: 100%; background: #f1f5f9; height: 12px; border-radius: 6px; overflow: hidden;"><div style="width: 100%; height: 100%; background: #e74c3c;"></div></div></div>
            <div style="margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Seu Sistema</span><span style="color:${cor}; font-weight: bold;">R$ ${seu.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div><div style="width: 100%; background: #f1f5f9; height: 12px; border-radius: 6px; overflow: hidden;"><div style="width: ${(seu/conv)*100}%; height: 100%; background: ${cor};"></div></div></div>
            <div style="text-align:center; margin-top:15px; padding:10px; color:${cor}; font-weight:bold; border-radius: 4px; border: 1px dashed ${cor}; font-size: 14px;">Economia Estimada: R$ ${econo > 0 ? econo.toLocaleString('pt-BR', {minimumFractionDigits:2}) : "0,00"}</div></div>`;
    }

    htmlPdf += `<p style="font-size:10px; text-align:center; margin-top:30px; color: #95a5a6;">* Documento gerado digitalmente pelo sistema oficial.</p></div>`;

    // --- HTML DO ROMANEIO ---
    let htmlRomaneio = `
    <div id="pdfRomaneio" style="padding: 40px; font-family: Arial, sans-serif; background: white; color: black; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
            <h1 style="margin: 0 0 5px 0; font-size: 22px; text-transform: uppercase;">ORDEM DE SEPARAÇÃO E CARGA (ROMANEIO)</h1>
            <p style="margin: 5px 0;"><strong>Obra / Cliente:</strong> ${nome.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} | <strong>Área Total:</strong> ${totalM2.toFixed(2)} m²</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr style="background: #eee;"><th style="border: 1px solid #000; padding: 8px; text-align: left;">Descrição do Item</th><th style="border: 1px solid #000; padding: 8px;">Quantidade para Carga</th></tr>
            ${romaneioRows}
        </table>
        <div style="margin-top: 80px; text-align: center; font-size: 14px;"><p>____________________________________________________________</p><p>Assinatura Expedição / Motorista</p></div>
    </div>`;

    const caixa = document.getElementById('caixaResultado');
    
    caixa.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; background: #0b0f19; padding: 15px; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
        <button id="btnPdf" style="flex:1; min-width: 150px; padding:15px; background:${cor}; color:white; border:none; font-weight:bold; border-radius:6px; cursor:pointer;">📄 BAIXAR PROPOSTA</button>
        <button id="btnZap" style="flex:1; min-width: 150px; padding:15px; background:#10b981; color:white; border:none; font-weight:bold; border-radius:6px; cursor:pointer;">💬 MANDAR NO ZAP</button>
        <button id="btnRom" style="flex:1; min-width: 150px; padding:15px; background:#475569; color:white; border:none; font-weight:bold; border-radius:6px; cursor:pointer;">🏭 BAIXAR ROMANEIO</button>
    </div>
    <div style="margin-bottom: 10px; color: #94a3b8; font-size: 12px; text-align: center;">⬇️ PREVIEW DA PROPOSTA ⬇️</div>
    <div style="background:#e2e8f0; padding:10px; border-radius:8px;">${htmlPdf}</div>
    <div style="margin-bottom: 10px; margin-top: 20px; color: #94a3b8; font-size: 12px; text-align: center;">⬇️ PREVIEW DO ROMANEIO ⬇️</div>
    <div style="background:#e2e8f0; padding:10px; border-radius:8px;">${htmlRomaneio}</div>
    `;
    
    caixa.style.display = 'block';

    // PDF SETUP APRIMORADO (Cortes laterais resolvidos)
    const optPDF = {
        margin: [10, 10, 10, 10], // Margem generosa de 1cm em cada lado para não cortar nada
        filename: `Proposta_${nome.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 800 }, // windowWidth simula uma tela de PC
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    document.getElementById('btnPdf').onclick = () => { 
        window.scrollTo(0,0);
        html2pdf().set(optPDF).from(document.getElementById('pdfContent')).save(); 
    };
    
    document.getElementById('btnRom').onclick = () => { 
        window.scrollTo(0,0);
        html2pdf().set(optPDF).from(document.getElementById('pdfRomaneio')).save(); 
    };
    
    document.getElementById('btnZap').onclick = () => {
        if(!telefone) return alert("Preencha o WhatsApp do cliente.");
        let t = `*PROPOSTA COMERCIAL* 🧱\n\nOlá, *${nome.toUpperCase()}*!\n\n📏 *Área Total:* ${totalM2.toFixed(2)} m²\n💰 *TOTAL A PAGAR:* R$ ${totalFinal.toLocaleString('pt-BR', {minimumFractionDigits:2})}\n\nEstou enviando o *PDF detalhado*!`;
        window.open(`https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(t)}`, '_blank');
    };
};

// ==========================================
// ☁️ GERENCIAMENTO E FILTROS (NUVEM E SESSÃO)
// ==========================================
async function atualizarSelectProjetos() {
    const user = auth.currentUser;
    const snap = (user.email === 'admin@blocok.com') ? await db.collection("obras").get() : await db.collection("obras").where("dono", "==", user.email).get();
    const select = document.getElementById('selectProjetos');
    select.innerHTML = '<option value="">-- Selecione Obra --</option>';
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.id}">${doc.id}</option>`; });
}

document.getElementById('btnSalvarProjeto').onclick = async () => {
    const nome = document.getElementById('nomeProjetoAtivo').value;
    if(!nome) return alert("Dê um nome à obra.");
    await db.collection("obras").doc(nome).set({ paredes: paredesMedidas, dono: auth.currentUser.email, data: new Date().toISOString() });
    alert("Obra Salva na Nuvem!"); atualizarSelectProjetos();
};

document.getElementById('btnCarregarProjeto').onclick = async () => {
    const nome = document.getElementById('selectProjetos').value;
    if(!nome) return alert("Selecione uma obra.");
    const doc = await db.collection("obras").doc(nome).get();
    if(doc.exists) { paredesMedidas = doc.data().paredes || []; renderizarTabela(); alert("Obra Carregada com Sucesso!"); }
};

document.getElementById('btnExcluirProjeto').onclick = async () => {
    const nome = document.getElementById('selectProjetos').value;
    if(!nome) return alert("Selecione uma obra.");
    if(confirm(`Apagar '${nome}' da nuvem?`)) {
        await db.collection("obras").doc(nome).delete(); alert("Apagada!"); atualizarSelectProjetos();
    }
};

document.getElementById('btnLimpar').onclick = () => { if(confirm("Limpar tela?")) { paredesMedidas = []; renderizarTabela(); } };

// Salvar/Carregar Rascunho Temporário (Local)
document.querySelectorAll('.save-state').forEach(i => { i.addEventListener('change', salvarEstadoLocal); i.addEventListener('input', salvarEstadoLocal); });
const chkInsumos = document.getElementById('chkInsumos'); const painelInsumos = document.getElementById('painelInsumos'); chkInsumos.addEventListener('change', () => { painelInsumos.style.display = chkInsumos.checked ? 'block' : 'none'; salvarEstadoLocal(); });
const chkComparativo = document.getElementById('chkComparativo'); const painelComparativo = document.getElementById('painelComparativo'); chkComparativo.addEventListener('change', () => { painelComparativo.style.display = chkComparativo.checked ? 'block' : 'none'; salvarEstadoLocal(); });
const chkCronograma = document.getElementById('chkCronograma'); const painelCronograma = document.getElementById('painelCronograma'); chkCronograma.addEventListener('change', () => { painelCronograma.style.display = chkCronograma.checked ? 'block' : 'none'; salvarEstadoLocal(); });

function salvarEstadoLocal() { localStorage.setItem('blocok_temp_paredes', JSON.stringify(paredesMedidas)); }
function carregarEstadoLocal() { const s = localStorage.getItem('blocok_temp_paredes'); if(s) { paredesMedidas = JSON.parse(s); renderizarTabela(); } }