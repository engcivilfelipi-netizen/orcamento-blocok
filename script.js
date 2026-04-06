const precosBlocok = {
    "10": { avista: 103.52, prazo: 109.07 },
    "13": { avista: 113.03, prazo: 118.98 },
    "15": { avista: 120.74, prazo: 127.09 },
    "20": { avista: 134.13, prazo: 141.19 }
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
// 📁 1. BANCO DE DADOS E AUTO-SAVE
// ==========================================

let projetosDB = JSON.parse(localStorage.getItem('blocok_projetosDB')) || {};

function atualizarSelectProjetos() {
    const select = document.getElementById('selectProjetos');
    select.innerHTML = '<option value="">-- Abrir Obra Salva --</option>';
    for (let nome in projetosDB) {
        select.innerHTML += `<option value="${nome}">${nome}</option>`;
    }
}

function salvarEstado() {
    const dados = { paredes: paredesMedidas, escala: pixelsPorMetro, inputs: {} };
    document.querySelectorAll('.save-state').forEach(input => {
        if(input.type === 'checkbox') dados.inputs[input.id] = input.checked;
        else dados.inputs[input.id] = input.value;
    });

    try {
        if(imagemPlanta.src && !imagemPlanta.src.startsWith('file')) {
            localStorage.setItem('blocokImage', imagemPlanta.src);
        }
    } catch(e) {}
    localStorage.setItem('blocokData', JSON.stringify(dados));
}

// CARREGAR COM SISTEMA "AUTO-CURA" (EVITA TRAVAMENTO)
function carregarEstado() {
    try {
        const dataJSON = localStorage.getItem('blocokData');
        if(dataJSON) {
            const dados = JSON.parse(dataJSON);
            paredesMedidas = dados.paredes || [];

            // VALIDAÇÃO DE SEGURANÇA: Se tiver dados velhos incompatíveis, ele limpa sozinho.
            if (paredesMedidas.length > 0 && typeof paredesMedidas[0] === 'number') {
                console.warn("Memória antiga detectada. Limpando por segurança.");
                paredesMedidas = [];
            }

            pixelsPorMetro = dados.escala || 0;

            for (let id in dados.inputs) {
                let el = document.getElementById(id);
                if(el) {
                    if(el.type === 'checkbox') el.checked = dados.inputs[id];
                    else el.value = dados.inputs[id];
                }
            }
            atualizarTabela();
            
            if(pixelsPorMetro > 0) {
                document.getElementById('btnMedir').disabled = false;
                document.getElementById('btnMedir').style.borderColor = '#ff6b00';
                document.getElementById('btnMedir').style.color = '#ff6b00';
            }
        }

        const savedImage = localStorage.getItem('blocokImage');
        if(savedImage) imagemPlanta.src = savedImage;
    } catch (erro) {
        console.error("Erro na memória do navegador. Resetando dados...", erro);
        localStorage.removeItem('blocokData');
        paredesMedidas = [];
    }
}

// Ações do Gerenciador
document.getElementById('btnSalvarProjeto').onclick = () => {
    let nome = document.getElementById('nomeProjetoAtivo').value.trim();
    if(!nome) return alert("Digite um nome para a obra no painel Gerenciador antes de salvar.");
    
    salvarEstado(); 
    const currentData = JSON.parse(localStorage.getItem('blocokData'));
    const currentImage = localStorage.getItem('blocokImage');
    if (currentImage) currentData.imagem = currentImage;

    projetosDB[nome] = currentData;
    localStorage.setItem('blocok_projetosDB', JSON.stringify(projetosDB));
    atualizarSelectProjetos();
    alert(`Obra '${nome}' salva com sucesso no banco de dados!`);
};

document.getElementById('btnCarregarProjeto').onclick = () => {
    let nome = document.getElementById('selectProjetos').value;
    if(!nome) return alert("Selecione uma obra na lista para abrir.");
    if(confirm("Isso vai substituir a Área de Trabalho atual. Deseja continuar?")) {
        let dados = projetosDB[nome];
        if (dados.imagem) {
            localStorage.setItem('blocokImage', dados.imagem);
            delete dados.imagem;
        } else {
            localStorage.removeItem('blocokImage');
        }
        localStorage.setItem('blocokData', JSON.stringify(dados));
        location.reload(); 
    }
};

document.getElementById('btnExcluirProjeto').onclick = () => {
    let nome = document.getElementById('selectProjetos').value;
    if(!nome) return alert("Selecione um projeto na lista para excluir.");
    if(confirm(`Tem certeza que deseja APAGAR DEFINITIVAMENTE a obra '${nome}'?`)) {
        delete projetosDB[nome];
        localStorage.setItem('blocok_projetosDB', JSON.stringify(projetosDB));
        atualizarSelectProjetos();
        alert("Obra excluída do banco de dados.");
    }
};

document.getElementById('btnLimpar').onclick = () => {
    if(confirm("ATENÇÃO: Isso vai apagar a Área de Trabalho (As obras salvas no banco não serão afetadas). Continuar?")) {
        localStorage.removeItem('blocokData');
        localStorage.removeItem('blocokImage');
        location.reload(); 
    }
};

document.querySelectorAll('.save-state').forEach(input => {
    input.addEventListener('change', salvarEstado);
    input.addEventListener('input', salvarEstado);
});

// Toggles Visuais
const chkInsumos = document.getElementById('chkInsumos');
const painelInsumos = document.getElementById('painelInsumos');
chkInsumos.addEventListener('change', () => { painelInsumos.style.display = chkInsumos.checked ? 'block' : 'none'; salvarEstado(); });

const chkComparativo = document.getElementById('chkComparativo');
const painelComparativo = document.getElementById('painelComparativo');
chkComparativo.addEventListener('change', () => { painelComparativo.style.display = chkComparativo.checked ? 'block' : 'none'; salvarEstado(); });


// ==========================================
// 🛠️ 2. LEVANTAMENTO E CALCULADORA
// ==========================================

document.getElementById('uploadPlanta').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { imagemPlanta.src = ev.target.result; salvarEstado(); }
    reader.readAsDataURL(e.target.files[0]);
};

imagemPlanta.onload = () => {
    canvas.width = imagemPlanta.width; canvas.height = imagemPlanta.height;
    ctx.drawImage(imagemPlanta, 0, 0);
    document.getElementById('btnCalibrar').disabled = false;
    document.getElementById('btnCalibrar').style.borderColor = '#00f0ff';
    document.getElementById('btnCalibrar').style.color = '#00f0ff';
    statusBar.innerText = "Planta pronta. Pode continuar o trabalho.";
};

document.getElementById('btnCalibrar').onclick = () => {
    estadoAtual = 'calibrando_p1'; statusBar.innerText = "Calibração: Clique no PONTO 1.";
};

document.getElementById('btnMedir').onclick = () => {
    if(pixelsPorMetro === 0) return alert("Calibre a escala primeiro!");
    estadoAtual = 'medindo_p1'; statusBar.innerText = "Medindo: Clique no INÍCIO da parede.";
};

canvas.onclick = (e) => {
    const x = e.offsetX; const y = e.offsetY;
    if (estadoAtual === 'calibrando_p1') {
        ponto1 = {x, y}; estadoAtual = 'calibrando_p2';
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#00f0ff'; ctx.fill();
        statusBar.innerText = "Calibração: Clique no PONTO 2.";
    } else if (estadoAtual === 'calibrando_p2') {
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#00f0ff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(ponto1.x, ponto1.y); ctx.lineTo(x,y); ctx.strokeStyle='#00f0ff'; ctx.stroke();
        
        let d = Math.sqrt(Math.pow(x-ponto1.x, 2) + Math.pow(y-ponto1.y, 2));
        let real = prompt("Quantos METROS REAIS tem essa linha? (Ex: 0.80)");
        if(real && !isNaN(real.replace(',','.'))) {
            pixelsPorMetro = d / parseFloat(real.replace(',','.'));
            document.getElementById('btnMedir').disabled = false;
            document.getElementById('btnMedir').style.borderColor = '#ff6b00';
            document.getElementById('btnMedir').style.color = '#ff6b00';
            estadoAtual = 'ocioso'; statusBar.innerText = "Escala configurada! Clique em '2. Medir'.";
            salvarEstado();
        }
    } else if (estadoAtual === 'medindo_p1') {
        ponto1 = {x, y}; estadoAtual = 'medindo_p2';
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#ff6b00'; ctx.fill();
        statusBar.innerText = "Medindo: Clique no FINAL da parede.";
    } else if (estadoAtual === 'medindo_p2') {
        ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.fillStyle='#ff6b00'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(ponto1.x, ponto1.y); ctx.lineTo(x,y); ctx.strokeStyle='#ff6b00'; ctx.lineWidth=3; ctx.stroke();
        
        let d = Math.sqrt(Math.pow(x-ponto1.x, 2) + Math.pow(y-ponto1.y, 2));
        let m = d / pixelsPorMetro;
        adicionarParede(m, document.getElementById('espessuraCorrente').value);
        estadoAtual = 'ocioso'; statusBar.innerText = "Parede gravada. Pode medir a próxima.";
    }
};

document.getElementById('btnAdicionarManual').onclick = () => {
    let input = document.getElementById('comprimentoManual');
    let v = parseFloat(input.value.replace(',','.'));
    if(v > 0) adicionarParede(v, document.getElementById('espessuraCorrente').value);
    input.value = '';
};

document.getElementById('btnAdicionarOitao').onclick = () => {
    let b = parseFloat(document.getElementById('baseOitao').value.replace(',','.'));
    let a = parseFloat(document.getElementById('alturaOitao').value.replace(',','.'));
    let esp = document.getElementById('espessuraCorrente').value;
    
    if(b > 0 && a > 0) {
        let areaFixaOitao = (b * a) / 2;
        paredesMedidas.push({ tipo: 'oitao', comp: b, alturaOitao: a, esp: esp, areaVaos: 0, areaFixa: areaFixaOitao });
        atualizarTabela(); salvarEstado();
        document.getElementById('baseOitao').value = ''; document.getElementById('alturaOitao').value = '';
    } else { alert("Preencha a Base e a Altura do Oitão corretamente."); }
};

function adicionarParede(comp, esp) {
    paredesMedidas.push({ tipo: 'parede', comp: comp, esp: esp, areaVaos: 0, areaFixa: 0 });
    atualizarTabela(); salvarEstado();
}

function removerP(index) {
    paredesMedidas.splice(index, 1);
    atualizarTabela(); salvarEstado();
}

window.addVao = function(index) {
    let l = prompt(`LARGURA do vão (m):`); if (!l || isNaN(l.replace(',','.'))) return;
    let a = prompt(`ALTURA do vão (m):`); if (!a || isNaN(a.replace(',','.'))) return;
    
    let areaVao = parseFloat(l.replace(',','.')) * parseFloat(a.replace(',','.'));
    paredesMedidas[index].areaVaos += areaVao;
    atualizarTabela(); salvarEstado();
};

function atualizarTabela() {
    const t = document.getElementById('corpoTabela');
    t.innerHTML = "";
    paredesMedidas.forEach((p, i) => {
        let txtVao = p.areaVaos > 0 ? `<span style="color:#ef4444;font-weight:bold;">-${p.areaVaos.toFixed(2)}</span>` : "0.00";
        let altOitaoSegura = p.alturaOitao ? p.alturaOitao.toFixed(2) : "0.00";
        let compSeguro = p.comp ? p.comp.toFixed(2) : "0.00";
        
        let desc = p.tipo === 'oitao' ? `B:${compSeguro} x A:${altOitaoSegura}` : `${compSeguro}m`;
        let badgeTipo = p.tipo === 'oitao' ? `<span style="color:#a855f7; font-weight:bold;">🔺 Oitão P${i+1}</span>` : `Parede P${i+1}`;

        t.innerHTML += `
            <tr>
                <td>${badgeTipo}</td>
                <td>${desc}</td>
                <td><span class="badge-esp">${p.esp}cm</span></td>
                <td>${txtVao}</td>
                <td class="acoes-tabela">
                    <button type="button" class="btn-add-vao" onclick="addVao(${i})">+ Vão</button>
                    <button type="button" class="btn-remover" onclick="removerP(${i})">X</button>
                </td>
            </tr>`;
    });
}

// Exportar CSV
document.getElementById('btnExportarExcel').onclick = () => {
    if(paredesMedidas.length === 0) return alert("Lista vazia. Não há o que exportar.");
    let csv = "Item;Tipo;Espessura(cm);Comp_Base(m);Altura_Oitao(m);Area_Vaos(m2)\n";
    paredesMedidas.forEach((p, i) => {
        let altOitao = p.tipo === 'oitao' ? (p.alturaOitao ? p.alturaOitao.toFixed(2) : "0.00") : "-";
        csv += `${i+1};${p.tipo ? p.tipo.toUpperCase() : 'PAREDE'};${p.esp};${p.comp.toFixed(2)};${altOitao};${p.areaVaos.toFixed(2)}\n`;
    });
    let blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Levantamento_BLOCOK_${new Date().getTime()}.csv`;
    link.click();
};

// ==========================================
// 🚀 3. INICIALIZAÇÃO E GERAÇÃO DO PDF
// ==========================================

// Chama no início para restaurar a tela
carregarEstado();
atualizarSelectProjetos();
painelInsumos.style.display = document.getElementById('chkInsumos').checked ? 'block' : 'none';
painelComparativo.style.display = document.getElementById('chkComparativo').checked ? 'block' : 'none';

document.getElementById('formCalculadora').onsubmit = (e) => {
    e.preventDefault();
    salvarEstado(); 

    if(paredesMedidas.length === 0) return alert("A lista de paredes está vazia.");

    let nome = document.getElementById('nomeProjetoAtivo').value || document.getElementById('nomeProjeto').value || "Não informado";
    let h = parseFloat(document.getElementById('alturaGlobal').value);
    let pag = document.getElementById('formaPagamento').value;
    
    let incluirInsumos = document.getElementById('chkInsumos').checked;
    let incluirComparativo = document.getElementById('chkComparativo').checked;

    let totalAreaBruta = 0, totalAreaLiquida = 0, valorTotalBlocos = 0, qtdTotalBlocos = 0;
    let resumoParedes = {}; 
    
    paredesMedidas.forEach(p => {
        if(!resumoParedes[p.esp]) resumoParedes[p.esp] = { bruta: 0, vaos: 0, liquida: 0 };
        
        let areaBrutaParede = p.tipo === 'oitao' ? p.areaFixa : (p.comp * h);
        let areaLiquidaParede = areaBrutaParede - p.areaVaos;
        if(areaLiquidaParede < 0) areaLiquidaParede = 0;

        resumoParedes[p.esp].bruta += areaBrutaParede;
        resumoParedes[p.esp].vaos += p.areaVaos;
        resumoParedes[p.esp].liquida += areaLiquidaParede;
        
        totalAreaBruta += areaBrutaParede;
        totalAreaLiquida += areaLiquidaParede;
    });

    let html = `
    <div id="pdfContent" style="padding: 30px; font-family: Arial, sans-serif; position: relative; overflow: hidden; background: white; color: black; min-height: 800px;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 140px; color: rgba(0, 0, 0, 0.04); font-weight: 900; letter-spacing: 15px; z-index: 0; pointer-events: none;">
            BLOCOK
        </div>

        <div style="position: relative; z-index: 1;">
            <div style="border-bottom: 2px solid #ff6b00; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #2c3e50; margin: 0 0 5px 0;">PROPOSTA TÉCNICA - SISTEMA BLOCOK</h1>
                <p style="margin: 2px 0;"><strong>Cliente / Projeto:</strong> ${nome.toUpperCase()}</p>
                <p style="margin: 2px 0;"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} | <strong>Área Total Const.:</strong> ${totalAreaLiquida.toFixed(2)}m²</p>
            </div>

            <h3 style="color: #2c3e50; font-size: 15px;">1. Quantitativo de Painéis (${pag === 'avista' ? 'À Vista' : 'A Prazo'})</h3>
            <table class="pdf-table">
                <tr><th>Espessura</th><th>Área Bruta</th><th>Descontos</th><th>Área Real</th><th>Qtd. Peças</th><th>Subtotal</th></tr>`;

    for (let esp in resumoParedes) {
        let dados = resumoParedes[esp];
        if (dados.bruta === 0) continue;
        let qtdBlocos = Math.ceil(dados.liquida / 0.81);
        let precoTotalBloco = precosBlocok[esp][pag] * qtdBlocos;
        
        qtdTotalBlocos += qtdBlocos; valorTotalBlocos += precoTotalBloco;

        html += `
                <tr>
                    <td><strong>${esp} cm</strong></td>
                    <td>${dados.bruta.toFixed(2)} m²</td>
                    <td style="color:#e74c3c;">- ${dados.vaos.toFixed(2)} m²</td>
                    <td style="color:#27ae60; font-weight:bold;">${dados.liquida.toFixed(2)} m²</td>
                    <td>${qtdBlocos} un.</td>
                    <td>R$ ${precoTotalBloco.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                </tr>`;
    }
    html += `</table>`;

    let valorTotalInsumos = 0;
    if (incluirInsumos) {
        let sacosArgamassa = Math.ceil(totalAreaLiquida / 10);
        let tubosPU = Math.ceil(totalAreaLiquida / 3);
        let rolosTela = Math.ceil((totalAreaLiquida * 2.2) / 50);

        let pArg = parseFloat(document.getElementById('precoArgamassa').value || 0);
        let pPU = parseFloat(document.getElementById('precoPU').value || 0);
        let pTela = parseFloat(document.getElementById('precoTela').value || 0);

        valorTotalInsumos = (sacosArgamassa * pArg) + (tubosPU * pPU) + (rolosTela * pTela);

        html += `
            <h3 style="color: #2c3e50; margin-top: 20px; font-size: 15px;">2. Materiais de Instalação Recomendados</h3>
            <table class="pdf-table">
                <tr><th>Insumo</th><th>Qtd. Estimada</th><th>Valor Unit.</th><th>Subtotal</th></tr>
                <tr><td>Argamassa Polimérica</td><td>${sacosArgamassa} scs</td><td>R$ ${pArg.toFixed(2)}</td><td>R$ ${(sacosArgamassa * pArg).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
                <tr><td>Espuma PU</td><td>${tubosPU} un.</td><td>R$ ${pPU.toFixed(2)}</td><td>R$ ${(tubosPU * pPU).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
                <tr><td>Tela Fibra</td><td>${rolosTela} rls</td><td>R$ ${pTela.toFixed(2)}</td><td>R$ ${(rolosTela * pTela).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
            </table>`;
    }

    let valorGlobalObra = valorTotalBlocos + valorTotalInsumos;

    html += `
            <div class="resumo-financeiro">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">
                    <span>Total Blocos:</span><strong>R$ ${valorTotalBlocos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>
                </div>`;
                
    if (incluirInsumos) {
        html += `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">
                    <span>Total Insumos:</span><strong>R$ ${valorTotalInsumos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>
                </div>`;
    }

    html += `
                <div style="display: flex; justify-content: space-between; font-size: 18px; color: #2c3e50; margin-top: 10px;">
                    <strong>TOTAL PRODUTOS:</strong><strong style="color: #ff6b00;">R$ ${valorGlobalObra.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>
                </div>
            </div>`;

    if (incluirComparativo) {
        let cBruto = parseFloat(document.getElementById('custoConvBruto').value || 0);
        let cPronto = parseFloat(document.getElementById('custoConvPronto').value || 0);
        let cMO = parseFloat(document.getElementById('custoBlocokMO').value || 0);

        let totalConvBruto = totalAreaLiquida * cBruto;
        let totalConvPronto = totalAreaLiquida * cPronto;
        let totalBlocokBruto = valorGlobalObra; 
        let totalBlocokPronto = valorGlobalObra + (totalAreaLiquida * cMO);

        let economiaReais = totalConvPronto - totalBlocokPronto;
        let pctEconomia = ((economiaReais / totalConvPronto) * 100).toFixed(1);

        html += `
            <h3 style="color: #2c3e50; margin-top: 25px; font-size: 15px; text-transform: uppercase;">Análise de Viabilidade</h3>
            <div class="box-comparativo">
                <h4 style="margin: 0 0 10px 0; color: #555;">A. Somente Material (Alvenaria Bruta)</h4>
                <div class="grafico-linha">
                    <span class="lbl-grafico">Tijolo Conv.</span>
                    <div class="barra-bg"><div class="barra-fill-bad" style="width: 100%;">&nbsp;</div></div>
                    <span class="val-grafico" style="color:#e74c3c;">R$ ${totalConvBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                </div>
                <div class="grafico-linha">
                    <span class="lbl-grafico">BLOCOK</span>
                    <div class="barra-bg"><div class="barra-fill-good" style="width: ${(totalBlocokBruto/totalConvBruto > 1 ? 100 : (totalBlocokBruto/totalConvBruto)*100)}%;">&nbsp;</div></div>
                    <span class="val-grafico" style="color:#27ae60;">R$ ${totalBlocokBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                </div>
                
                <h4 style="margin: 15px 0 10px 0; color: #2c3e50;">B. Parede Pronta (Material + Mão de Obra)</h4>
                <div class="grafico-linha">
                    <span class="lbl-grafico">Convencional</span>
                    <div class="barra-bg"><div class="barra-fill-bad" style="width: 100%;">&nbsp;</div></div>
                    <span class="val-grafico" style="color:#e74c3c;">R$ ${totalConvPronto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                </div>
                <div class="grafico-linha">
                    <span class="lbl-grafico">BLOCOK Pronto</span>
                    <div class="barra-bg"><div class="barra-fill-good" style="width: ${(totalBlocokPronto/totalConvPronto)*100}%;">&nbsp;</div></div>
                    <span class="val-grafico" style="color:#27ae60;">R$ ${totalBlocokPronto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                </div>
                
                <div style="text-align: center; margin-top: 15px; padding: 10px; background: #e8f8f5; border-radius: 4px; color: #27ae60; font-weight: bold; font-size: 16px;">
                    Economia Estimada: R$ ${economiaReais > 0 ? economiaReais.toLocaleString('pt-BR', {minimumFractionDigits:2}) : "0,00"} (${economiaReais > 0 ? pctEconomia : "0"}%)
                </div>
            </div>`;
    }

    html += `
            <p style="font-size: 10px; color: #95a5a6; text-align: center; margin-top: 20px;">
                * Documento gerado digitalmente. Valores sujeitos à confirmação.
            </p>
        </div>
    </div>
    
    <button id="downloadPdf" style="margin-top:20px; width: 100%; padding: 15px; background: #ef4444; color: white; border: none; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">
        📄 Baixar Proposta em PDF
    </button>`;

    const caixa = document.getElementById('caixaResultado');
    caixa.innerHTML = html; 
    caixa.style.display = 'block';

    document.getElementById('downloadPdf').onclick = () => {
        const el = document.getElementById('pdfContent');
        const btn = document.getElementById('downloadPdf');
        btn.innerText = "⏳ Gerando...";
        btn.style.backgroundColor = "#475569";
        
        html2pdf().set({ 
            margin: 0, 
            filename: `Proposta_BLOCOK_${nome.replace(/\s+/g, '_')}.pdf`, 
            html2canvas: {scale: 2, scrollY: 0},
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(el).save().then(() => {
            btn.innerText = "✅ PDF Salvo!";
            btn.style.backgroundColor = "#10b981";
            setTimeout(() => {
                btn.innerText = "📄 Baixar Proposta em PDF";
                btn.style.backgroundColor = "#ef4444";
            }, 3000);
        });
    };
};