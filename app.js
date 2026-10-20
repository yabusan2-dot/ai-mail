// 不動産実務用 2段階用件マスタ定義（トーン指示）
const purposeMaster = {
    management: {
        label: "🏢 物件管理・入居者・オーナー関係",
        csvFile: "management.csv",
        tone: "【文体ルール】管理会社としての信頼感を最優先し、礼儀正しく堅実で安心感のあるビジネス文書（ですます調）にしてください。",
        items: [
            { text: "設備不具合（水漏れ・共用灯等）の対応進捗報告", subject: "【ご報告】管理物件の設備修繕の進捗状況について" },
            { text: "契約更新手続き書類の発送とご案内", subject: "【重要】賃貸借契約更新手続きに関するご案内" }
        ]
    },
    construction: {
        label: "🛠️ 施工・修繕サービス関係",
        csvFile: "construction.csv",
        tone: "【文体ルール】現場の職人や協力業者向けです。時候の挨拶は一切省き、工事場所、工期、依頼内容の要点が箇条書き等で一目で伝わる、簡潔な職人文体にしてください。",
        items: [
            { text: "退去にともなう原状回復工事の見積もり依頼", subject: "【見積依頼】原状回復工事（物件名・号室）" },
            { text: "施工箇所の写真確認にともなう現地手直し依頼", subject: "【是正依頼】現地手直し・補修のお願い" }
        ]
    },
    new_client: {
        label: "🔑 新規顧客・内見案内関係",
        csvFile: "new_client.csv",
        tone: "【文体ルール】お部屋探しをしている一般の「見込み顧客」向けです。不動産の専門用語は一切使わず噛み砕き、内見を楽しみにしてもらえるような、明るく優しく丁寧でソフトな文体にしてください。",
        items: [
            { text: "週末の現地内見の日程調整", subject: "【日程調整】お部屋の内見ご案内について" },
            { text: "ご希望条件にマッチした新着・未公開物件の提案", subject: "【新着情報】ご希望条件に合うおすすめ物件のご案内" }
        ]
    }
};

let clientDatabase = []; // 現在選ばれているカテゴリの顧客リスト

document.addEventListener("DOMContentLoaded", () => {
    initCategoryDropdown();
    initDragAndDrop();
});

// 大分類プルダウンの初期生成
function initCategoryDropdown() {
    const catSelect = document.getElementById('categorySelect');
    catSelect.innerHTML = '';
    Object.keys(purposeMaster).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = purposeMaster[key].label;
        catSelect.appendChild(opt);
    });
    // 初回実行
    onCategoryChange();
}

// 💡 職人思想：大分類が変わったら、対応するCSVを自動で裏読みし、小分類も同期する（ロックされた安全な誘導）
async function onCategoryChange() {
    const catKey = document.getElementById('categorySelect').value;
    
    // 1. 小分類プルダウンの同期
    const subSelect = document.getElementById('subPurposeSelect');
    subSelect.innerHTML = '';
    purposeMaster[catKey].items.forEach((item, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = item.text;
        subSelect.appendChild(opt);
    });

    // 2. 対応する個別CSVファイルの自動読み込み（一元管理）
    const targetCsv = purposeMaster[catKey].csvFile;
    const status = document.getElementById("statusMessage");
    clientDatabase = []; // リストを初期化
    
    try {
        const response = await fetch(targetCsv);
        if (response.ok) {
            const csvText = await response.text();
            // 新規読み込み（マージフラグ=false）
            parseCsv(csvText, false);
            status.textContent = `✅ 「${targetCsv}」からデータを読み込みました。`;
        } else {
            refreshClientDropdown();
            status.textContent = `ℹ️ ${targetCsv} が見つかりません。ファイルをD&Dしてください。`;
        }
    } catch (e) {
        refreshClientDropdown();
        status.textContent = "ℹ️ ローカル起動中。CSVファイルをドラッグ＆ドロップしてください。";
    }
}

// ドラッグ＆ドロップの制限設定（リファクタリング）
function initDragAndDrop() {
    const container = document.getElementById('mainContainer');
    window.addEventListener('dragover', (e) => e.preventDefault());
    
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // 💡 職人思想：現在の選択が「新規顧客（new_client）」の時だけD&Dを許可するガードレール
        const currentCategory = document.getElementById('categorySelect').value;
        if (currentCategory !== 'new_client') {
            alert("⚠️ 顧客の追加読込は「新規顧客・内見案内」画面の時のみ有効です。物件管理・施工マスタは保護されています。");
            return;
        }

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                parseCsv(event.target.result, true); // 新規顧客の末尾に追加マージ
                document.getElementById("statusMessage").textContent = `➕ 外部ファイル「${file.name}」から新規顧客を追加しました。`;
            };
            reader.readAsText(file, 'utf-8');
        }
    });
}

// CSVの超堅牢パース処理（先頭カンマなしの救済ロジック内包）
function parseCsv(csvText, isMerge) {
    const lines = csvText.split(/\r\n|\n/);
    
    if (!isMerge) {
        clientDatabase = [];
    }

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const cols = lines[i].split(',');
        
        let company = "";
        let name = "";
        let email = "";

        // 💡 職人の救済トポロジー：列の数（カンマの数）に応じて、データのズレを自動補正する
        if (cols.length >= 3) {
            // 正規のパターン（会社名、氏名、メール）
            company = cols[0] ? cols[0].trim() : "";
            name = cols[1] ? cols[1].trim() : "";
            email = cols[2] ? cols[2].trim() : "";
        } else if (cols.length === 2) {
            // 先頭カンマを忘れたパターン（氏名、メールの2列しかないと判断し、会社名を空にする）
            company = ""; 
            name = cols[0] ? cols[0].trim() : "";
            email = cols[1] ? cols[1].trim() : "";
        } else {
            // 1列しかないような明らかなゴミデータはスキップ
            continue; 
        }

        // メールアドレスが入っていないものはさすがに弾くが、それ以外は救済してプール
        if (!email) continue;

        clientDatabase.push({
            company: company,
            name: name,
            email: email
        });
    }

    refreshClientDropdown();
}

// 顧客プルダウンの再描画
function refreshClientDropdown() {
    const select = document.getElementById("clientSelect");
    select.innerHTML = "";

    if (clientDatabase.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-- 登録データがありません --";
        select.appendChild(opt);
        document.getElementById("clientEmail").value = "";
        document.getElementById("dbStatus").textContent = "マスタ未読込";
        return;
    }

    clientDatabase.forEach((client, index) => {
        const opt = document.createElement("option");
        opt.value = index;
        opt.textContent = client.company ? `${client.company} (${client.name})` : client.name;
        select.appendChild(opt);
    });

    document.getElementById("dbStatus").textContent = `読込済（${clientDatabase.length}件）`;
    onClientChange();
}

function onClientChange() {
    const index = document.getElementById("clientSelect").value;
    if(index === "") return;
    const client = clientDatabase[index];
    document.getElementById("clientEmail").value = client ? client.email : "";
}

// AI通信および文章生成
async function generateMailBody() {
    const clientId = document.getElementById("clientSelect").value;
    if(clientId === "") {
        alert("送り先を選択してください。");
        return;
    }
    const client = clientDatabase[clientId];
    const catKey = document.getElementById("categorySelect").value;
    const subIndex = document.getElementById("subPurposeSelect").value;
    const subItem = purposeMaster[catKey].items[subIndex];
    const detail = document.getElementById("customDetail").value;

    const genBtn = document.getElementById("genBtn");
    const statusMessage = document.getElementById("statusMessage");
    
    genBtn.disabled = true;
    statusMessage.textContent = "⏳ 不動産特化プロンプトでAIに問い合わせ中...";

    const prompt = `
    取引先の「${client.company} ${client.name}」宛てに、「${subItem.text}」という用件でメールを送ります。
    ${purposeMaster[catKey].tone}
    【具体的な補足事項】
    ${detail || "特になし。状況に合わせた標準的な案内文にしてください。"}
    宛先ヘッダーや、末尾の署名は含めないで、指定された文体ルールに準拠した【本文のコア部分】のみを出力してください。
    `;

    try {
        const response = await fetch("http://localhost:3000/api/generate-mail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        
        const headerStr = client.company ? `${client.company}\n${client.name} 御中\n\n` : `${client.name}\n\n`;
        const fullMail = `${headerStr}いつも大変お世話になっております。\n〇〇不動産管理の 山田 です。\n\n${data.text}\n\n以上、ご確認のほどよろしくお願い申し上げます。\n\n---------------------------------------------\n〇〇不動産管理 株式会社\n担当：山田 太郎（TEL: 03-XXXX-XXXX）\n---------------------------------------------`;

        document.getElementById("resultPreview").value = fullMail;
        statusMessage.textContent = "✅ 生成完了しました！文体を確認してメールソフトを起動してください。";
    } catch (error) {
        statusMessage.textContent = "❌ 通信エラー。server_mail.mjs（ポート3000）が起動しているか確認してください。";
    } finally {
        genBtn.disabled = false;
    }
}

// メールクライアント起動
function launchMailClient() {
    const clientId = document.getElementById("clientSelect").value;
    if(clientId === "") return;
    const client = clientDatabase[clientId];
    const catKey = document.getElementById("categorySelect").value;
    const subIndex = document.getElementById("subPurposeSelect").value;
    const subItem = purposeMaster[catKey].items[subIndex];
    const bodyText = document.getElementById("resultPreview").value;

    if(!bodyText) {
        alert("先にAI文章を生成してください。");
        return;
    }

    const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subItem.subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoUrl;
}
